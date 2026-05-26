'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { storePdf } from '@/lib/blob-storage';
import { sendEmail, responseEmail } from '@/lib/email';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  Server actions for /courrier/depart (B5)
//
//  Roles allowed to send outbound mail:
//    - ADMIN
//    - CHEF_BUREAU_DEPART  (primary role)
//    - CHEF_SERVICE_COURRIER (supervisor)
//
//  Send flow:
//    1. Validate inputs (response PDF + cover-letter body text)
//    2. Upload the response PDF as a DocumentVersion (kind: RESPONSE_FINAL)
//    3. Email the émetteur with the cover-letter body in plain HTML
//    4. Create DG_TO_COURRIER + RESPONSE_OUT handoffs (audit trail)
//    5. Set document.status = RESPONSE_SENT + responseSentAt = now
//
//  Admin-shortcut: markDecidedForTesting() temporarily bumps a doc to
//  DECIDED so we can test the outbound flow before B7-B15 (DG decision)
//  are built. Visible only to ADMIN, will become irrelevant later.
// ============================================================================

const ALLOWED_ROLES: StaffRole[] = [
  'ADMIN',
  'CHEF_BUREAU_DEPART',
  'CHEF_SERVICE_COURRIER',
];

async function assertDepart(): Promise<{ id: string; role: StaffRole }> {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
    throw new Error('UNAUTHORIZED');
  }
  return { id: session.user.id!, role };
}

async function assertAdmin(): Promise<{ id: string }> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('UNAUTHORIZED');
  return { id: session.user.id! };
}

// ----------------------------------------------------------------------------
// sendResponse — main action
// ----------------------------------------------------------------------------

export type SendResponseState = {
  ok?: boolean;
  reference?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const SendSchema = z.object({
  documentId: z.string().min(1),
  coverLetter: z
    .string()
    .min(20, 'La lettre d\'accompagnement doit faire au moins 20 caractères.')
    .max(4000),
  recipientOverrideEmail: z
    .string()
    .email('Email invalide.')
    .optional()
    .or(z.literal('')),
});

const ACCEPTED_MIMETYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export async function sendResponse(
  _prev: SendResponseState,
  formData: FormData,
): Promise<SendResponseState> {
  try {
    const { id: userId } = await assertDepart();

    const parsed = SendSchema.safeParse({
      documentId: formData.get('documentId'),
      coverLetter: formData.get('coverLetter'),
      recipientOverrideEmail: formData.get('recipientOverrideEmail') || '',
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    // ---- File ----
    const file = formData.get('responseFile') as File | null;
    if (!file || file.size === 0) {
      return { fieldErrors: { responseFile: "Veuillez joindre la réponse signée (PDF)." } };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { fieldErrors: { responseFile: 'Fichier trop volumineux (10 Mo max).' } };
    }
    if (!ACCEPTED_MIMETYPES.has(file.type)) {
      return {
        fieldErrors: { responseFile: `Type non supporté (${file.type || 'inconnu'}).` },
      };
    }

    // ---- Load the document (must be at DECIDED status) ----
    const doc = await db.document.findUnique({
      where: { id: parsed.data.documentId },
      select: {
        id: true,
        reference: true,
        subject: true,
        status: true,
        submission: {
          select: { senderName: true, senderEmail: true, senderOrganization: true },
        },
      },
    });
    if (!doc) return { error: 'Document introuvable.' };
    if (doc.status !== 'DECIDED') {
      return {
        error: `Statut inattendu : ${doc.status}. Seuls les documents au statut DECIDED peuvent être expédiés.`,
      };
    }

    const recipientEmail =
      parsed.data.recipientOverrideEmail?.trim() ||
      doc.submission?.senderEmail ||
      '';
    if (!recipientEmail) {
      return {
        error: "Pas d'adresse email pour l'émetteur. Saisissez-la dans le champ « Adresse de réponse ».",
      };
    }
    const recipientName = doc.submission?.senderName ?? 'Destinataire';

    // ---- Upload the response PDF ----
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const sha256 = await hashSha256(buffer);
    const stored = await storePdf({
      pathname: `documents/${doc.reference}/response-${Date.now()}-${safeName(file.name)}`,
      file,
      contentType: file.type,
    });

    // ---- DB writes ----
    const now = new Date();
    await db.$transaction(async (tx) => {
      // Store the response as a versioned file on the document
      await tx.documentVersion.create({
        data: {
          documentId: doc.id,
          kind: 'RESPONSE_FINAL',
          fileName: safeName(file.name),
          storageUri: stored.url,
          sha256,
          sizeBytes: stored.size,
          mimeType: stored.contentType,
          uploadedByUserId: userId,
        },
      });

      // DG → Courrier handoff (B14.5 — Courrier transit rule)
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'DG_TO_COURRIER',
          fromRole: 'DG',
          toRole: 'CHEF_BUREAU_DEPART',
          toUserId: userId,
          reason: 'Décision DG transmise au Bureau Départ pour expédition.',
        },
      });

      // Bureau Départ → émetteur (the actual outbound step)
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'RESPONSE_OUT',
          fromRole: 'CHEF_BUREAU_DEPART',
          fromUserId: userId,
          toRole: null,
          reason: `Réponse expédiée à ${recipientEmail}.`,
        },
      });

      // Internal note with the cover-letter body (visible to other staff)
      await tx.comment.create({
        data: {
          documentId: doc.id,
          authorUserId: userId,
          authorRole: 'CHEF_BUREAU_DEPART',
          body: `[Lettre d'accompagnement envoyée]\n\n${parsed.data.coverLetter}`,
        },
      });

      // Status transition
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'RESPONSE_SENT',
          responseSentAt: now,
          currentHolderRole: null,
        },
      });
    });

    // ---- Email the émetteur (graceful: logs in dev) ----
    const { subject, html } = responseEmail({
      recipientName,
      reference: doc.reference,
      originalSubject: doc.subject,
      coverLetterBody: parsed.data.coverLetter,
      attachmentUrl: stored.stub ? undefined : stored.url,
    });
    await sendEmail({ to: recipientEmail, subject, html });

    revalidatePath('/courrier/depart');
    revalidatePath('/admin/data');
    return { ok: true, reference: doc.reference };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas les droits Bureau Départ.' };
    }
    console.error('[sendResponse]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ----------------------------------------------------------------------------
// markDecidedForTesting — admin-only shortcut so B5 can be tested before
// B7-B15 (DG decision flow) are built. Bumps a document from any non-terminal
// status straight to DECIDED so it appears in Bureau Départ's corbeille.
// Becomes irrelevant once the real DG decision step exists.
// ----------------------------------------------------------------------------

export async function markDecidedForTesting(
  documentId: string,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    await assertAdmin();
    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, reference: true },
    });
    if (!doc) return { error: 'Document introuvable.' };
    if (doc.status === 'RESPONSE_SENT' || doc.status === 'CLOSED') {
      return { error: `Document déjà expédié (statut ${doc.status}).` };
    }

    await db.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          status: 'DECIDED',
          decidedAt: new Date(),
          currentHolderRole: 'CHEF_BUREAU_DEPART',
        },
      });
      await tx.comment.create({
        data: {
          documentId,
          authorUserId: (await auth())!.user!.id!,
          authorRole: 'ADMIN',
          body:
            '[Admin shortcut · B5 test] Document promu au statut DECIDED ' +
            'pour tester le flux Bureau Départ. À retirer dès que la décision ' +
            'DG réelle (B15) sera implémentée.',
        },
      });
    });

    revalidatePath('/courrier/arrivee');
    revalidatePath('/courrier/depart');
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ----------------------------------------------------------------------------
// Helpers (mirror of courrier-arrivee.ts)
// ----------------------------------------------------------------------------

async function hashSha256(buf: Buffer): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(buf).digest('hex');
}

function safeName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);
}
