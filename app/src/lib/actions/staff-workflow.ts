'use server';

import { revalidatePath } from 'next/cache';
import { ConventionStatus, type ConventionStage } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';
import { canActOnStage, nextStage } from '@/lib/staff-permissions';
import { sendEmail } from '@/lib/email';

// ---- shared helpers ----

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  if (!isStaffRole(session.user.role)) throw new Error('Forbidden');
  return session;
}

async function loadConvention(id: string) {
  const cv = await db.convention.findUnique({
    where: { id },
    include: { investor: { include: { user: true } } },
  });
  if (!cv) throw new Error('Convention introuvable.');
  return cv;
}

function refreshConvention(id: string) {
  revalidatePath(`/staff/conventions/${id}`);
  revalidatePath('/staff/inbox');
  revalidatePath('/staff/recent');
  revalidatePath('/staff/all');
  revalidatePath('/investor');
  revalidatePath(`/investor/conventions/${id}`);
}

async function notifyInvestor(args: {
  forUserId: string;
  conventionId: string;
  kind: 'STAGE_RECEIVED' | 'STAGE_HANDOFF' | 'CONVENTION_RETURNED' | 'DOCUMENT_INCOMPLETE' | 'CONVENTION_SIGNED';
  title: string;
  body?: string;
}) {
  await db.notification.create({
    data: {
      forUserId: args.forUserId,
      conventionId: args.conventionId,
      kind: args.kind,
      title: args.title,
      body: args.body,
      link: `/investor/conventions/${args.conventionId}`,
    },
  });
}

// =============================================================
// Document verification
// =============================================================

export async function acceptDocumentAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const documentId = String(formData.get('documentId') ?? '');
  if (!documentId) return;

  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return;

  const cv = await loadConvention(doc.conventionId);
  if (!canActOnStage(session.user.role as never, cv.currentStage)) return;

  await db.document.update({
    where: { id: documentId },
    data: {
      verification: 'ACCEPTED',
      verifiedAt: new Date(),
      verifiedByUserId: session.user.id,
      rejectionReason: null,
    },
  });
  refreshConvention(doc.conventionId);
}

export async function rejectDocumentAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const documentId = String(formData.get('documentId') ?? '');
  const reason     = String(formData.get('reason')     ?? '').trim();
  if (!documentId) return;
  if (!reason || reason.length < 5) throw new Error('Motif requis (5 caractères min).');

  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return;
  const cv = await loadConvention(doc.conventionId);
  if (!canActOnStage(session.user.role as never, cv.currentStage)) return;

  await db.document.update({
    where: { id: documentId },
    data: {
      verification: 'REJECTED',
      verifiedAt: new Date(),
      verifiedByUserId: session.user.id,
      rejectionReason: reason,
    },
  });

  if (cv.investor.user.id) {
    await notifyInvestor({
      forUserId: cv.investor.user.id,
      conventionId: cv.id,
      kind: 'DOCUMENT_INCOMPLETE',
      title: `Pièce à retransmettre — ${cv.reference}`,
      body: reason,
    });
  }

  refreshConvention(doc.conventionId);
}

// =============================================================
// Issue récépissé (Secrétariat only)
// =============================================================

export async function issueRecepisseAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const conventionId = String(formData.get('conventionId') ?? '');
  if (!conventionId) return;

  const cv = await loadConvention(conventionId);
  if (cv.currentStage !== 'SECRETARY') throw new Error('Le récépissé est délivré au Secrétariat uniquement.');
  if (!canActOnStage(session.user.role as never, 'SECRETARY')) throw new Error('Action réservée au Secrétariat.');
  if (cv.recepisseAt) throw new Error('Récépissé déjà délivré.');
  if (cv.status !== 'SUBMITTED') throw new Error('Convention non soumise.');

  // All 6 mandatory docs must be accepted before issuing récépissé.
  const docs = await db.document.findMany({
    where: { conventionId },
    select: { kind: true, verification: true },
  });
  const required = ['REGISTRATION', 'TAX_ID', 'NON_REDEVANCE', 'COMPANY_STATUTES', 'FEASIBILITY_STUDY', 'FINANCING_PROOF'];
  const okKinds = new Set(docs.filter((d) => d.verification === 'ACCEPTED').map((d) => d.kind));
  const missing = required.filter((k) => !okKinds.has(k as never));
  if (missing.length > 0) {
    throw new Error(`Impossible : ${missing.length} pièce(s) ne sont pas encore acceptées.`);
  }

  const recepisseNo = await nextRecepisseNumber();
  const now = new Date();

  await db.$transaction([
    db.convention.update({
      where: { id: conventionId },
      data: {
        recepisseAt: now,
        recepisseNo,
        recepisseUserId: session.user.id,
      },
    }),
    db.workflowEvent.create({
      data: {
        conventionId,
        stage: 'SECRETARY',
        action: 'RECEIPT_ISSUED',
        actorUserId: session.user.id,
        comment: `Récépissé ${recepisseNo} délivré · délai légal de 10 j ouvrés démarré.`,
      },
    }),
  ]);

  // Notify + email investor
  if (cv.investor.user.id) {
    await notifyInvestor({
      forUserId: cv.investor.user.id,
      conventionId,
      kind: 'STAGE_RECEIVED',
      title: `Récépissé de dépôt délivré — ${cv.reference}`,
      body: `Récépissé n° ${recepisseNo}. Le délai légal d'instruction de 10 jours ouvrés commence à courir à compter d'aujourd'hui.`,
    });
  }
  if (cv.investor.user.email) {
    const html = recepisseEmailHtml({
      contactName: cv.investor.user.name ?? cv.investor.raisonSociale,
      raisonSociale: cv.investor.raisonSociale,
      reference: cv.reference,
      recepisseNo,
      issuedAt: now,
    });
    await sendEmail({
      to: cv.investor.user.email,
      subject: `Récépissé ${recepisseNo} délivré — API Cameroun`,
      html,
    });
  }

  refreshConvention(conventionId);
}

// =============================================================
// Sign off the current stage
// =============================================================

export async function signoffStageAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const conventionId = String(formData.get('conventionId') ?? '');
  const comment      = String(formData.get('comment')      ?? '').trim() || null;
  if (!conventionId) return;

  const cv = await loadConvention(conventionId);
  if (!canActOnStage(session.user.role as never, cv.currentStage)) {
    throw new Error('Action réservée au responsable de l\'étape actuelle.');
  }
  if (cv.status !== 'SUBMITTED') throw new Error('Convention non en instruction.');

  // Secretariat needs récépissé first
  if (cv.currentStage === 'SECRETARY' && !cv.recepisseAt) {
    throw new Error('Délivrez le récépissé avant la signature.');
  }

  await db.workflowEvent.create({
    data: {
      conventionId,
      stage: cv.currentStage,
      action: 'SIGNED_OFF',
      actorUserId: session.user.id,
      comment,
    },
  });

  refreshConvention(conventionId);
}

// =============================================================
// Hand off to the next stage
// =============================================================

export async function handoffStageAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const conventionId = String(formData.get('conventionId') ?? '');
  if (!conventionId) return;

  const cv = await loadConvention(conventionId);
  if (!canActOnStage(session.user.role as never, cv.currentStage)) {
    throw new Error('Action réservée au responsable de l\'étape actuelle.');
  }
  if (cv.status !== 'SUBMITTED') throw new Error('Convention non en instruction.');

  // Must have signed off this stage first
  const signedOff = await db.workflowEvent.findFirst({
    where: { conventionId, stage: cv.currentStage, action: 'SIGNED_OFF' },
    orderBy: { createdAt: 'desc' },
  });
  if (!signedOff) throw new Error('Signez d\'abord l\'étape avant la transmission.');

  const next = nextStage(cv.currentStage);

  await db.$transaction(async (tx) => {
    await tx.workflowEvent.create({
      data: {
        conventionId,
        stage: cv.currentStage,
        action: 'HANDED_OFF',
        actorUserId: session.user.id,
        comment: next ? `Transmis à ${next.replace('DIR_', 'Dir. ').replace('DG', 'Directeur Général')}` : 'Transmission finale',
      },
    });
    if (next) {
      await tx.convention.update({
        where: { id: conventionId },
        data: { currentStage: next },
      });
      await tx.workflowEvent.create({
        data: {
          conventionId,
          stage: next,
          action: 'RECEIVED',
        },
      });
    }
  });

  refreshConvention(conventionId);
}

// =============================================================
// Return dossier to investor
// =============================================================

export async function returnToInvestorAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const conventionId = String(formData.get('conventionId') ?? '');
  const reason       = String(formData.get('reason')       ?? '').trim();
  if (!conventionId) return;
  if (!reason || reason.length < 5) throw new Error('Motif requis (5 caractères min).');

  const cv = await loadConvention(conventionId);
  if (!canActOnStage(session.user.role as never, cv.currentStage)) {
    throw new Error('Action réservée au responsable de l\'étape actuelle.');
  }
  if (cv.status !== 'SUBMITTED') throw new Error('Convention non en instruction.');

  await db.$transaction([
    db.convention.update({
      where: { id: conventionId },
      data: { status: ConventionStatus.RETURNED },
    }),
    db.workflowEvent.create({
      data: {
        conventionId,
        stage: cv.currentStage,
        action: 'RETURNED',
        actorUserId: session.user.id,
        comment: reason,
      },
    }),
  ]);

  if (cv.investor.user.id) {
    await notifyInvestor({
      forUserId: cv.investor.user.id,
      conventionId,
      kind: 'CONVENTION_RETURNED',
      title: `Dossier renvoyé pour complément — ${cv.reference}`,
      body: reason,
    });
  }
  if (cv.investor.user.email) {
    await sendEmail({
      to: cv.investor.user.email,
      subject: `Dossier ${cv.reference} renvoyé pour complément`,
      html: returnedEmailHtml({
        contactName: cv.investor.user.name ?? cv.investor.raisonSociale,
        reference: cv.reference,
        reason,
      }),
    });
  }

  refreshConvention(conventionId);
}

// =============================================================
// helpers
// =============================================================

async function nextRecepisseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REC-${year}-`;
  const last = await db.convention.findFirst({
    where: { recepisseNo: { startsWith: prefix } },
    orderBy: { recepisseNo: 'desc' },
    select: { recepisseNo: true },
  });
  let next = 1;
  if (last?.recepisseNo) {
    const tail = Number(last.recepisseNo.slice(prefix.length));
    if (Number.isFinite(tail)) next = tail + 1;
  }
  return `${prefix}${String(next).padStart(6, '0')}`;
}

// ---- email templates ----

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function recepisseEmailHtml(args: { contactName: string; raisonSociale: string; reference: string; recepisseNo: string; issuedAt: Date }): string {
  const dateStr = args.issuedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0a0a0a; max-width: 560px; margin: 0 auto;">
      <div style="border-top: 4px solid #006b3a; padding: 32px 28px 8px;">
        <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6b6b; font-weight: 700;">
          Agence de Promotion des Investissements
        </div>
        <h1 style="font-family: Georgia, serif; font-size: 22px; margin: 12px 0 6px;">Récépissé de dépôt délivré</h1>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">Bonjour ${escHtml(args.contactName)},</p>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Le Secrétariat de l&#39;API a vérifié la conformité de votre dossier
          <strong>${escHtml(args.raisonSociale)}</strong> et délivre par le présent message votre
          récépissé de dépôt.
        </p>
        <div style="border: 2px solid #006b3a; padding: 18px 22px; margin: 18px 0; background: #f3f8f5;">
          <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #006b3a; font-weight: 700; margin-bottom: 6px;">Récépissé</div>
          <div style="font-family: 'Courier New', monospace; font-size: 15px; font-weight: bold; color: #006b3a;">
            N° ${escHtml(args.recepisseNo)}
          </div>
          <div style="font-size: 12px; color: #444; margin-top: 4px;">
            Délivré le ${dateStr} · dossier ${escHtml(args.reference)}
          </div>
        </div>
        <div style="border-left: 3px solid #c1973f; padding: 12px 16px; margin: 18px 0; background: #fbf5e6;">
          <strong style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #a47e2c;">
            Délai légal d&#39;instruction
          </strong>
          <p style="font-size: 13px; color: #1f2937; line-height: 1.6; margin: 6px 0 0;">
            Le délai de <strong>10 jours ouvrés</strong> court à compter de ce jour
            (Art. 30.3 de l&#39;Ordonnance n° 2025/002).  Vous serez notifié à chaque
            étape de validation.
          </p>
        </div>
      </div>
      <div style="border-top: 1px solid #e5e5e5; padding: 18px 28px; font-size: 11px; color: #8a8a8a;">
        ⚜ API Cameroun · Secrétariat
      </div>
    </div>
  `;
}

function returnedEmailHtml(args: { contactName: string; reference: string; reason: string }): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0a0a0a; max-width: 560px; margin: 0 auto;">
      <div style="border-top: 4px solid #b03b3b; padding: 32px 28px 8px;">
        <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6b6b; font-weight: 700;">
          Agence de Promotion des Investissements
        </div>
        <h1 style="font-family: Georgia, serif; font-size: 22px; margin: 12px 0 6px;">Dossier ${escHtml(args.reference)} — complément demandé</h1>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">Bonjour ${escHtml(args.contactName)},</p>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Votre dossier a été renvoyé pour complément. Connectez-vous à votre espace investisseur
          pour corriger ou remplacer les pièces concernées, puis soumettez à nouveau.
        </p>
        <div style="border: 1px solid #d4d4d4; padding: 16px 18px; margin: 18px 0; background: #fafafa;">
          <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; font-weight: 700; margin-bottom: 6px;">Motif</div>
          <div style="font-size: 13px; color: #1f2937; line-height: 1.6; white-space: pre-wrap;">${escHtml(args.reason)}</div>
        </div>
      </div>
      <div style="border-top: 1px solid #e5e5e5; padding: 18px 28px; font-size: 11px; color: #8a8a8a;">
        ⚜ API Cameroun
      </div>
    </div>
  `;
}
