'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ConventionStage, ConventionStatus, type DocumentKind, type Sector, type ProjectType } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { storePdf, removeBlob } from '@/lib/blob-storage';
import { sendEmail } from '@/lib/email';
import { REQUIRED_DOC_KINDS, MAX_UPLOAD_BYTES, ACCEPTED_MIME, findRequiredDoc } from '@/lib/required-documents';
import { categoryFor, type CreateConventionState, type CreateConventionValues, type UploadDocState, type SubmitConventionState } from '@/lib/convention-config';
import { sectorLabel } from '@/lib/stages';
import { formatFcfaCompact } from '@/lib/fcfa';

// ---- helpers ----

async function requireInvestor() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  if (session.user.role && session.user.role !== 'INVESTOR') {
    throw new Error('Forbidden');
  }
  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
  });
  if (!investor) throw new Error('Profil investisseur introuvable.');
  return { session, investor };
}

async function loadOwnedConvention(conventionId: string, investorId: string) {
  const cv = await db.convention.findUnique({ where: { id: conventionId } });
  if (!cv || cv.investorId !== investorId) {
    throw new Error('Convention introuvable.');
  }
  return cv;
}

async function nextConventionReference(): Promise<string> {
  // CV-YYYY-NNNNNN — next free number for the current year.
  const year = new Date().getFullYear();
  const prefix = `CV-${year}-`;
  const last = await db.convention.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  let next = 1;
  if (last) {
    const tail = Number(last.reference.slice(prefix.length));
    if (Number.isFinite(tail)) next = tail + 1;
  }
  return `${prefix}${String(next).padStart(6, '0')}`;
}

async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---- 1. Create a DRAFT convention from the project-info form ----

export async function createDraftConventionAction(
  _prev: CreateConventionState,
  formData: FormData,
): Promise<CreateConventionState> {
  const { investor } = await requireInvestor();

  const projectName    = String(formData.get('projectName')    ?? '').trim();
  const sector         = String(formData.get('sector')         ?? '');
  const projectType    = String(formData.get('projectType')    ?? '');
  const region         = String(formData.get('region')         ?? '').trim();
  const investmentStr  = String(formData.get('investmentFcfa') ?? '').replace(/[^\d]/g, '');
  const jobsStr        = String(formData.get('jobsPlanned')    ?? '').replace(/[^\d]/g, '');

  const values: CreateConventionValues = {
    projectName, sector, projectType, region,
    investmentFcfa: investmentStr, jobsPlanned: jobsStr,
  };

  if (!projectName)                 return { status: 'error', error: 'Le nom du projet est requis.', values };
  if (!sector)                      return { status: 'error', error: 'Le secteur est requis.', values };
  if (!projectType)                 return { status: 'error', error: 'Le type de projet est requis.', values };
  if (!region)                      return { status: 'error', error: 'La région est requise.', values };
  if (!investmentStr)               return { status: 'error', error: 'Le montant d\'investissement est requis.', values };

  let amount: bigint;
  try {
    amount = BigInt(investmentStr);
  } catch {
    return { status: 'error', error: 'Montant invalide.', values };
  }
  if (amount <= 0n) return { status: 'error', error: 'Le montant doit être strictement positif.', values };

  const jobs = jobsStr ? Number(jobsStr) : 0;
  if (jobs < 0 || !Number.isFinite(jobs)) {
    return { status: 'error', error: 'Nombre d\'emplois invalide.', values };
  }

  const reference = await nextConventionReference();

  const created = await db.convention.create({
    data: {
      reference,
      investorId: investor.id,
      projectName,
      sector: sector as Sector,
      region,
      projectType: projectType as ProjectType,
      investmentFcfa: amount,
      jobsPlanned: jobs,
      category: categoryFor(amount),
      status: ConventionStatus.DRAFT,
      currentStage: ConventionStage.SECRETARY,
    },
  });

  revalidatePath('/investor');
  redirect(`/investor/conventions/${created.id}/edit`);
}

// ---- 2. Upload a document into one of the 6 slots ----

export async function uploadDocumentAction(
  _prev: UploadDocState,
  formData: FormData,
): Promise<UploadDocState> {
  const { investor } = await requireInvestor();

  const conventionId = String(formData.get('conventionId') ?? '');
  const kind         = String(formData.get('kind')         ?? '') as DocumentKind;
  const file         = formData.get('file');

  if (!conventionId || !kind || !(file instanceof File)) {
    return { status: 'error', error: 'Données du formulaire incomplètes.' };
  }
  if (!REQUIRED_DOC_KINDS.includes(kind)) {
    return { status: 'error', error: 'Type de pièce inconnu.' };
  }
  if (file.size === 0) {
    return { status: 'error', error: 'Fichier vide.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { status: 'error', error: 'Fichier trop volumineux (10 Mo maximum).' };
  }
  const type = file.type || 'application/pdf';
  if (!ACCEPTED_MIME.includes(type as typeof ACCEPTED_MIME[number])) {
    return { status: 'error', error: 'Format non supporté (PDF uniquement).' };
  }

  const cv = await loadOwnedConvention(conventionId, investor.id);
  if (cv.status !== 'DRAFT' && cv.status !== 'RETURNED') {
    return { status: 'error', error: 'Ce dossier n\'accepte plus de pièces.' };
  }

  // Replace existing doc of the same kind, if any.
  const existing = await db.document.findFirst({
    where: { conventionId, kind },
    select: { id: true, storageUri: true },
  });

  const sha = await hashFile(file);
  const stored = await storePdf({
    pathname: `conventions/${conventionId}/${kind}-${Date.now()}.pdf`,
    file,
  });

  if (existing) {
    await removeBlob(existing.storageUri);
    await db.document.update({
      where: { id: existing.id },
      data: {
        fileName: file.name,
        storageUri: stored.url,
        sha256: sha,
        sizeBytes: file.size,
        mimeType: stored.contentType,
        verification: 'PENDING',
        verifiedAt: null,
        verifiedByUserId: null,
        rejectionReason: null,
        uploadedAt: new Date(),
      },
    });
    revalidatePath(`/investor/conventions/${conventionId}/edit`);
    return { status: 'success', documentId: existing.id };
  }

  const doc = await db.document.create({
    data: {
      conventionId,
      kind,
      fileName: file.name,
      storageUri: stored.url,
      sha256: sha,
      sizeBytes: file.size,
      mimeType: stored.contentType,
      verification: 'PENDING',
    },
  });
  revalidatePath(`/investor/conventions/${conventionId}/edit`);
  return { status: 'success', documentId: doc.id };
}

// ---- 3. Remove a document from a slot ----

export async function removeDocumentAction(formData: FormData): Promise<void> {
  const { investor } = await requireInvestor();
  const documentId = String(formData.get('documentId') ?? '');
  if (!documentId) return;

  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) return;
  const cv = await loadOwnedConvention(doc.conventionId, investor.id);
  if (cv.status !== 'DRAFT' && cv.status !== 'RETURNED') return;

  await removeBlob(doc.storageUri);
  await db.document.delete({ where: { id: documentId } });
  revalidatePath(`/investor/conventions/${doc.conventionId}/edit`);
}

// ---- 4. Submit the dossier ----

export async function submitConventionAction(
  _prev: SubmitConventionState,
  formData: FormData,
): Promise<SubmitConventionState> {
  const { investor, session } = await requireInvestor();
  const conventionId = String(formData.get('conventionId') ?? '');
  if (!conventionId) return { status: 'error', error: 'Convention manquante.' };

  const cv = await loadOwnedConvention(conventionId, investor.id);
  if (cv.status !== 'DRAFT' && cv.status !== 'RETURNED') {
    return { status: 'error', error: 'Ce dossier a déjà été soumis.' };
  }

  // Verify all 6 mandatory documents are present.
  const docs = await db.document.findMany({
    where: { conventionId, kind: { in: [...REQUIRED_DOC_KINDS] } },
    select: { kind: true },
  });
  const present = new Set(docs.map((d) => d.kind));
  const missing = REQUIRED_DOC_KINDS.filter((k) => !present.has(k));
  if (missing.length > 0) {
    return { status: 'error', error: `Il manque ${missing.length} pièce${missing.length > 1 ? 's' : ''} obligatoire${missing.length > 1 ? 's' : ''}.` };
  }

  // Move convention to SUBMITTED and write a workflow event.
  const now = new Date();
  await db.$transaction([
    db.convention.update({
      where: { id: conventionId },
      data: {
        status: ConventionStatus.SUBMITTED,
        currentStage: ConventionStage.SECRETARY,
        submittedAt: now,
      },
    }),
    db.workflowEvent.create({
      data: {
        conventionId,
        stage: ConventionStage.SECRETARY,
        action: 'RECEIVED',
        actorUserId: session.user.id ?? null,
        comment: 'Dossier soumis par l\'investisseur.',
      },
    }),
  ]);

  // Confirmation email (graceful fallback when no Resend key).
  const recipient = session.user.email ?? undefined;
  if (recipient) {
    const html = submittedEmailHtml({
      contactName: session.user.name ?? investor.raisonSociale,
      raisonSociale: investor.raisonSociale,
      reference: cv.reference,
      projectName: cv.projectName,
      sector: sectorLabel(cv.sector),
      amountLabel: formatFcfaCompact(cv.investmentFcfa),
    });
    await sendEmail({
      to: recipient,
      subject: `Dossier ${cv.reference} reçu — API Cameroun`,
      html,
    });
  }

  revalidatePath('/investor');
  revalidatePath(`/investor/conventions/${conventionId}/edit`);
  redirect(`/investor?submitted=${cv.reference}`);
}

// ---- email body ----

function submittedEmailHtml(args: {
  contactName: string;
  raisonSociale: string;
  reference: string;
  projectName: string;
  sector: string;
  amountLabel: string;
}): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0a0a0a; max-width: 560px; margin: 0 auto;">
      <div style="border-top: 4px solid #006b3a; padding: 32px 28px 8px;">
        <div style="font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: #6b6b6b; font-weight: 700;">
          Agence de Promotion des Investissements
        </div>
        <h1 style="font-family: Georgia, serif; font-size: 22px; margin: 12px 0 6px;">Votre dossier a bien été transmis</h1>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">Bonjour ${esc(args.contactName)},</p>
        <p style="font-size: 14px; color: #444; line-height: 1.6;">
          Le dossier de demande d&#39;agrément de <strong>${esc(args.raisonSociale)}</strong> a bien été transmis
          au Secrétariat de l&#39;API.
        </p>
        <div style="border: 1px solid #d4d4d4; padding: 16px 18px; margin: 18px 0; background: #fafafa;">
          <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; font-weight: 700; margin-bottom: 6px;">Référence du dossier</div>
          <div style="font-family: 'Courier New', monospace; font-size: 13px;">
            Référence&nbsp;: <strong>${esc(args.reference)}</strong><br>
            Projet&nbsp;: ${esc(args.projectName)}<br>
            Secteur&nbsp;: ${esc(args.sector)}<br>
            Montant&nbsp;: ${esc(args.amountLabel)}
          </div>
        </div>
        <div style="border-left: 3px solid #c1973f; padding: 12px 16px; margin: 18px 0; background: #fbf5e6;">
          <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #a47e2c; font-weight: 700; margin-bottom: 4px;">Prochaine étape</div>
          <div style="font-size: 13px; color: #1f2937; line-height: 1.6;">
            Le Secrétariat va maintenant vérifier la conformité des pièces produites. Si le dossier
            est complet et conforme, vous recevrez un <strong>récépissé de dépôt par email</strong>.
            Le délai légal d&#39;instruction de <strong>10 jours ouvrés</strong> court à compter de
            la délivrance de ce récépissé (Art. 30.3 de l&#39;Ordonnance n° 2025/002).
          </div>
        </div>
        <p style="font-size: 13px; color: #6b6b6b; line-height: 1.6;">
          Vous serez notifié à chaque étape de validation (Secrétariat → Direction des
          Investissements → Conformité → Relations Extérieures → Directeur Général).
        </p>
      </div>
      <div style="border-top: 1px solid #e5e5e5; padding: 18px 28px; font-size: 11px; color: #8a8a8a;">
        ⚜ API Cameroun · Portail officiel d&#39;agrément
      </div>
    </div>
  `;
}
