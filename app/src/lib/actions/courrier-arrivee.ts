'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { storePdf } from '@/lib/blob-storage';
import { sendEmail, acknowledgementEmail } from '@/lib/email';
import { nextCourrierReference } from '@/lib/reference';
import type { StaffRole, SourceChannel, DocumentNature } from '@prisma/client';

// ============================================================================
//  Server actions for /courrier/arrivee (B4)
//
//  Roles allowed to register an incoming document:
//    - ADMIN
//    - CHEF_BUREAU_ARRIVEE  (primary role)
//    - CHEF_SERVICE_COURRIER (supervisor)
//
//  On register:
//    1. Validate inputs (sender, subject, nature, source channel)
//    2. Generate next COURRIER-YYYY-NNNNNN reference (Postgres advisory lock)
//    3. Upload the file (Vercel Blob or local stub)
//    4. Insert Document + Submission + DocumentVersion(ORIGINAL) + Handoff(COURRIER_TO_DG)
//    5. Send acknowledgement email (logs only if RESEND_API_KEY missing)
//
//  Returns the reference so the UI can confirm it inline.
// ============================================================================

export type RegisterArriveeState = {
  ok?: boolean;
  reference?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ALLOWED_ROLES: StaffRole[] = [
  'ADMIN',
  'CHEF_BUREAU_ARRIVEE',
  'CHEF_SERVICE_COURRIER',
];

async function assertCourrier(): Promise<{ id: string; role: StaffRole }> {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
    throw new Error('UNAUTHORIZED');
  }
  return { id: session.user.id!, role };
}

// Subset of DocumentNature exposed to the form (the rest can be added later)
const NATURE_VALUES: DocumentNature[] = [
  'AGREMENT_REQUEST',
  'GENERAL_CORRESPONDENCE',
  'OFFICIAL_NOTIFICATION',
  'PARTNERSHIP_PROPOSAL',
  'COMPLAINT',
  'REPORT',
  'OTHER',
];

const CHANNEL_VALUES: SourceChannel[] = ['ONLINE', 'COURRIER_PHYSICAL', 'ANTENNE'];

const RegisterSchema = z.object({
  senderName: z.string().min(2, 'Nom de l\'émetteur requis.').max(120),
  senderEmail: z.string().email('Email invalide.'),
  senderOrganization: z.string().max(160).optional().nullable(),
  senderPhone: z.string().max(40).optional().nullable(),
  senderType: z
    .enum(['Investisseur', 'Particulier', 'Administration', 'Entreprise', 'Autre'])
    .default('Investisseur'),
  subject: z.string().min(5, 'Objet trop court.').max(400),
  nature: z.enum(NATURE_VALUES as [DocumentNature, ...DocumentNature[]]),
  sourceChannel: z.enum(CHANNEL_VALUES as [SourceChannel, ...SourceChannel[]]),
  notes: z.string().max(2000).optional().nullable(),
});

const ACCEPTED_MIMETYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

export async function registerArrivedDocument(
  _prev: RegisterArriveeState,
  formData: FormData,
): Promise<RegisterArriveeState> {
  try {
    const { id: userId } = await assertCourrier();

    // ---- Parse + validate scalar fields ----
    const parsed = RegisterSchema.safeParse({
      senderName: formData.get('senderName'),
      senderEmail: formData.get('senderEmail'),
      senderOrganization: formData.get('senderOrganization') || null,
      senderPhone: formData.get('senderPhone') || null,
      senderType: formData.get('senderType') ?? 'Investisseur',
      subject: formData.get('subject'),
      nature: formData.get('nature'),
      sourceChannel: formData.get('sourceChannel'),
      notes: formData.get('notes') || null,
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
    const file = formData.get('document') as File | null;
    if (!file || file.size === 0) {
      return { fieldErrors: { document: 'Veuillez joindre le document scanné (PDF ou image).' } };
    }
    if (file.size > 10 * 1024 * 1024) {
      return { fieldErrors: { document: 'Fichier trop volumineux (10 Mo maximum).' } };
    }
    if (!ACCEPTED_MIMETYPES.has(file.type)) {
      return {
        fieldErrors: { document: `Type non supporté (${file.type || 'inconnu'}). PDF ou image attendu.` },
      };
    }

    // ---- Reference + storage ----
    const reference = await nextCourrierReference();
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);
    const sha256 = await hashSha256(buffer);

    const stored = await storePdf({
      pathname: `documents/${reference}/original-${Date.now()}-${safeName(file.name)}`,
      file,
      contentType: file.type,
    });

    // ---- DB writes (single transaction) ----
    const data = parsed.data;
    const now = new Date();

    const document = await db.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          reference,
          subject: data.subject,
          nature: data.nature,
          status: 'AWAITING_DG_ANALYSIS',
          sourceChannel: data.sourceChannel,
          submittedAt: now,
          acknowledgedAt: now,
          currentHolderRole: 'DG',
          submission: {
            create: {
              senderName: data.senderName,
              senderEmail: data.senderEmail.toLowerCase().trim(),
              senderOrganization: data.senderOrganization ?? null,
              senderPhone: data.senderPhone ?? null,
              senderType: data.senderType,
              submittedVia: data.sourceChannel,
              registeredAt: now,
              acknowledgementSentAt: now,
              acknowledgementCode: reference,
              registeredByUserId: userId,
            },
          },
          versions: {
            create: {
              kind: 'ORIGINAL',
              fileName: safeName(file.name),
              storageUri: stored.url,
              sha256,
              sizeBytes: stored.size,
              mimeType: stored.contentType,
              uploadedByUserId: userId,
            },
          },
        },
        select: { id: true, reference: true, subject: true },
      });

      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'COURRIER_TO_DG',
          fromRole: 'CHEF_BUREAU_ARRIVEE',
          fromUserId: userId,
          toRole: 'DG',
          reason:
            data.sourceChannel === 'ONLINE'
              ? "Document reçu en ligne · transmis pour analyse DG."
              : data.sourceChannel === 'COURRIER_PHYSICAL'
              ? "Document reçu physiquement · scanné · transmis pour analyse DG."
              : "Document reçu via une antenne · transmis pour analyse DG.",
        },
      });

      // Optional internal note from the courrier agent (visible to DG)
      if (data.notes && data.notes.trim().length > 0) {
        await tx.comment.create({
          data: {
            documentId: doc.id,
            authorUserId: userId,
            authorRole: 'CHEF_BUREAU_ARRIVEE',
            body: `[Note du Bureau Arrivée] ${data.notes.trim()}`,
          },
        });
      }

      // NOTE: hash-chained AuditTrailEntry rows are written in B22 — for now
      // the Handoff + DocumentVersion rows are sufficient provenance.
      return doc;
    });

    // ---- Acknowledgement email (graceful: logs in dev) ----
    const { subject, html } = acknowledgementEmail({
      recipientName: data.senderName,
      reference: document.reference,
      subject: document.subject,
      registeredAt: now,
    });
    await sendEmail({
      to: data.senderEmail.toLowerCase().trim(),
      subject,
      html,
    });

    revalidatePath('/courrier/arrivee');
    revalidatePath('/admin/data');
    return { ok: true, reference: document.reference };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas les droits Service du Courrier.' };
    }
    console.error('[courrier:registerArrivedDocument]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

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
