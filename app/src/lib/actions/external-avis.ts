'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import { notifyRole } from '@/lib/notify';
import { writeAudit } from '@/lib/audit';
import type { StaffRole, ExternalRecipient } from '@prisma/client';

// ============================================================================
//  B14 — External avis (Min. Finances, DGI, DGD, autres administrations)
//
//  Three actions covering the full lifecycle of an ExternalTransmission:
//
//    requestExternalAvis  → Sends a document out for external opinion.
//                           Document transitions IN_TREATMENT|ASSIGNED →
//                           AWAITING_EXTERNAL_AVIS. Current Assignment stays
//                           ACTIVE (the requesting unit retains ownership;
//                           they're just blocked waiting for input).
//                           Creates an ExternalTransmission (PENDING) and
//                           an EXTERNAL_OUT handoff.
//
//    recordExternalAvis   → The unit receives the external avis (typically
//                           by post / email / fax) and records it. The
//                           ExternalTransmission becomes RESPONSE_RECEIVED,
//                           an EXTERNAL_IN handoff is logged, the document
//                           returns to IN_TREATMENT, and the avis text is
//                           saved as a tagged Comment so it's visible to
//                           anyone in the chain.
//
//    cancelExternalAvis   → The request is withdrawn (e.g. no response after
//                           weeks, or the unit decides it can proceed
//                           without external input). Transmission becomes
//                           CANCELLED; doc returns to IN_TREATMENT.
//
//  Auth: any non-DG/DGA role with an ACTIVE Assignment on the document.
//  ADMIN works on behalf of the assigned role (same pattern as B11-B13).
// ============================================================================

const FORBIDDEN: StaffRole[] = ['DG', 'DGA'];

async function assertUnitMember(): Promise<{ id: string; role: StaffRole }> {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user || !role) throw new Error('UNAUTHORIZED');
  if (FORBIDDEN.includes(role)) throw new Error('UNAUTHORIZED');
  return { id: session.user.id!, role };
}

async function findActiveAssignment(documentId: string, role: StaffRole) {
  if (role === 'ADMIN') {
    return db.assignment.findFirst({
      where: { documentId, status: 'ACTIVE' },
      orderBy: { assignedAt: 'desc' },
      select: { id: true, assignedToRole: true },
    });
  }
  return db.assignment.findFirst({
    where: { documentId, assignedToRole: role, status: 'ACTIVE' },
    orderBy: { assignedAt: 'desc' },
    select: { id: true, assignedToRole: true },
  });
}

const RECIPIENT_LABEL_FR: Record<ExternalRecipient, string> = {
  MINISTRE_FINANCES:    'Ministère des Finances',
  MINISTRE_INDUSTRIE:   'Ministère de l\'Industrie',
  DGI:                  'Direction Générale des Impôts (DGI)',
  DGD:                  'Direction Générale des Douanes (DGD)',
  MINISTRE_AUTRE:       'Autre ministère',
  ADMINISTRATION_AUTRE: 'Autre administration',
};

const RECIPIENT_VALUES: ExternalRecipient[] = [
  'MINISTRE_FINANCES',
  'MINISTRE_INDUSTRIE',
  'DGI',
  'DGD',
  'MINISTRE_AUTRE',
  'ADMINISTRATION_AUTRE',
];

const REQUIRES_NAME: Set<ExternalRecipient> = new Set([
  'MINISTRE_AUTRE',
  'ADMINISTRATION_AUTRE',
]);

// ----------------------------------------------------------------------------
//  requestExternalAvis
// ----------------------------------------------------------------------------

export type RequestExternalAvisResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  recipientLabel?: string;
};

const RequestExternalSchema = z.object({
  documentId:       z.string().min(1),
  recipient:        z.enum(RECIPIENT_VALUES as [ExternalRecipient, ...ExternalRecipient[]]),
  recipientName:    z.string().max(200).optional().nullable(),
  recipientEmail:   z.string().email('Email invalide.').max(200).optional().nullable().or(z.literal('')),
  recipientAddress: z.string().max(500).optional().nullable(),
  purpose:          z.string({ required_error: 'Motif de la demande requis.' })
                      .min(10, 'Motif trop court (10 caractères minimum).')
                      .max(2000),
  expectedReturnDays: z.coerce.number().int().min(1).max(365).optional().nullable(),
});

export async function requestExternalAvis(
  _prev: RequestExternalAvisResult,
  formData: FormData,
): Promise<RequestExternalAvisResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = RequestExternalSchema.safeParse({
      documentId:         formData.get('documentId'),
      recipient:          formData.get('recipient'),
      recipientName:      formData.get('recipientName') || null,
      recipientEmail:     formData.get('recipientEmail') || null,
      recipientAddress:   formData.get('recipientAddress') || null,
      purpose:            formData.get('purpose'),
      expectedReturnDays: formData.get('expectedReturnDays') || null,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    // Cross-field validation: free-form recipients need a name
    if (REQUIRES_NAME.has(parsed.data.recipient)) {
      const name = parsed.data.recipientName?.trim();
      if (!name) {
        return {
          fieldErrors: { recipientName: 'Nom du destinataire requis pour ce type.' },
        };
      }
    }

    const doc = await db.document.findUnique({
      where: { id: parsed.data.documentId },
      select: { id: true, status: true, reference: true },
    });
    if (!doc) return { error: 'Document introuvable.' };

    const assignment = await findActiveAssignment(doc.id, role);
    if (!assignment) {
      return { error: 'Aucune affectation active pour votre rôle sur ce document.' };
    }

    if (doc.status !== 'ASSIGNED' && doc.status !== 'IN_TREATMENT') {
      return {
        error:
          `Statut inattendu : ${doc.status}. Une demande d'avis externe n'est possible ` +
          `que sur les documents ASSIGNED ou IN_TREATMENT.`,
      };
    }

    const effectiveRole = role === 'ADMIN' ? assignment.assignedToRole : role;
    const recipientLabel = RECIPIENT_LABEL_FR[parsed.data.recipient];
    const displayName = parsed.data.recipientName?.trim() || recipientLabel;
    const fromLabel = roleLabel(effectiveRole);

    const now = new Date();
    const expectedReturnAt = parsed.data.expectedReturnDays
      ? new Date(now.getTime() + parsed.data.expectedReturnDays * 24 * 60 * 60 * 1000)
      : null;

    await db.$transaction(async (tx) => {
      // 1. ExternalTransmission row
      await tx.externalTransmission.create({
        data: {
          documentId: doc.id,
          recipient: parsed.data.recipient,
          recipientName: parsed.data.recipientName?.trim() || null,
          recipientEmail: parsed.data.recipientEmail?.trim() || null,
          recipientAddress: parsed.data.recipientAddress?.trim() || null,
          purpose: parsed.data.purpose.trim(),
          sentAt: now,
          sentByUserId: userId,
          expectedReturnAt,
          status: 'PENDING',
        },
      });

      // 2. EXTERNAL_OUT handoff (toRole = null since it's leaving the org)
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'EXTERNAL_OUT',
          fromRole: effectiveRole,
          fromUserId: userId,
          toRole: null,
          reason:
            `${fromLabel} sollicite un avis externe auprès de ${displayName}` +
            (parsed.data.purpose ? ` (motif : ${parsed.data.purpose.trim().slice(0, 200)}${parsed.data.purpose.length > 200 ? '…' : ''})` : '') +
            '.',
        },
      });

      // 3. Comment with the full purpose text (for traceability)
      await tx.comment.create({
        data: {
          documentId: doc.id,
          authorUserId: userId,
          authorRole: effectiveRole,
          body:
            `[Demande d'avis externe → ${displayName}]\n\n` +
            `Motif : ${parsed.data.purpose.trim()}` +
            (expectedReturnAt
              ? `\n\nRetour attendu avant le ${expectedReturnAt.toLocaleDateString('fr-FR')}.`
              : ''),
        },
      });

      // 4. Document transitions: status changes, current holder UNCHANGED
      //    (the requesting unit keeps ownership; they're just waiting).
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'AWAITING_EXTERNAL_AVIS',
          // currentHolderRole + currentHolderUserId unchanged
        },
      });

      await writeAudit(tx, {
        actorUserId: userId,
        entityType: 'document',
        entityId: doc.id,
        action: 'EXTERNAL_AVIS_REQUESTED',
        before: { status: doc.status },
        after: { status: 'AWAITING_EXTERNAL_AVIS', reference: doc.reference, byRole: effectiveRole, recipient: displayName },
      });
    });

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    return { ok: true, recipientLabel: displayName };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[requestExternalAvis]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ----------------------------------------------------------------------------
//  recordExternalAvis
// ----------------------------------------------------------------------------

export type RecordExternalAvisResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const RecordExternalSchema = z.object({
  documentId:     z.string().min(1),
  transmissionId: z.string().min(1),
  opinionSummary: z.string({ required_error: 'Résumé de l\'avis requis.' })
                    .min(10, 'Résumé trop court (10 caractères minimum).')
                    .max(4000),
});

export async function recordExternalAvis(
  _prev: RecordExternalAvisResult,
  formData: FormData,
): Promise<RecordExternalAvisResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = RecordExternalSchema.safeParse({
      documentId:     formData.get('documentId'),
      transmissionId: formData.get('transmissionId'),
      opinionSummary: formData.get('opinionSummary'),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    const doc = await db.document.findUnique({
      where: { id: parsed.data.documentId },
      select: { id: true, status: true, reference: true },
    });
    if (!doc) return { error: 'Document introuvable.' };

    const transmission = await db.externalTransmission.findUnique({
      where: { id: parsed.data.transmissionId },
      select: {
        id: true, documentId: true, status: true, recipient: true,
        recipientName: true,
      },
    });
    if (!transmission) return { error: 'Transmission externe introuvable.' };
    if (transmission.documentId !== doc.id) {
      return { error: 'Cette transmission ne correspond pas au document.' };
    }
    if (transmission.status !== 'PENDING') {
      return { error: `Cette transmission est déjà ${transmission.status}.` };
    }

    const assignment = await findActiveAssignment(doc.id, role);
    if (!assignment) {
      return { error: 'Aucune affectation active pour votre rôle sur ce document.' };
    }

    if (doc.status !== 'AWAITING_EXTERNAL_AVIS') {
      return {
        error:
          `Statut inattendu : ${doc.status}. Le document n'est pas en attente d'avis externe.`,
      };
    }

    const effectiveRole = role === 'ADMIN' ? assignment.assignedToRole : role;
    const displayName =
      transmission.recipientName?.trim() || RECIPIENT_LABEL_FR[transmission.recipient];
    const now = new Date();

    await db.$transaction(async (tx) => {
      // 1. Mark transmission as RESPONSE_RECEIVED, save the summary
      await tx.externalTransmission.update({
        where: { id: transmission.id },
        data: {
          status: 'RESPONSE_RECEIVED',
          receivedAt: now,
          opinionSummary: parsed.data.opinionSummary.trim(),
        },
      });

      // 2. EXTERNAL_IN handoff (fromRole = null since it's arriving from outside)
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'EXTERNAL_IN',
          fromRole: null,
          fromUserId: null,
          toRole: effectiveRole,
          toUserId: userId,
          reason: `Avis externe reçu de ${displayName} — enregistré par ${roleLabel(effectiveRole)}.`,
        },
      });

      // 3. The avis itself as a tagged Comment (visible to anyone in the chain)
      await tx.comment.create({
        data: {
          documentId: doc.id,
          authorUserId: userId,
          authorRole: effectiveRole,
          body:
            `[Avis externe reçu de ${displayName}]\n\n${parsed.data.opinionSummary.trim()}`,
        },
      });

      // 4. Document: resume work
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'IN_TREATMENT',
        },
      });

      // 5. Notify the requesting unit's role (B17)
      await notifyRole(tx, effectiveRole, {
        documentId: doc.id,
        kind: 'EXTERNAL_AVIS_RECEIVED',
        title: `Avis externe reçu de ${displayName}`,
        body: `${doc.reference} — vous pouvez reprendre le traitement avec l'avis joint en note.`,
        link: `/unit/parapheur/${doc.id}`,
        excludeUserId: userId,
      });

      await writeAudit(tx, {
        actorUserId: userId,
        entityType: 'document',
        entityId: doc.id,
        action: 'EXTERNAL_AVIS_RECORDED',
        before: { status: 'AWAITING_EXTERNAL_AVIS' },
        after: { status: 'IN_TREATMENT', reference: doc.reference, byRole: effectiveRole, recipient: displayName },
      });
    });

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[recordExternalAvis]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ----------------------------------------------------------------------------
//  cancelExternalAvis
// ----------------------------------------------------------------------------

export type CancelExternalAvisResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const CancelExternalSchema = z.object({
  documentId:     z.string().min(1),
  transmissionId: z.string().min(1),
  reason:         z.string().max(2000).optional().nullable(),
});

export async function cancelExternalAvis(
  _prev: CancelExternalAvisResult,
  formData: FormData,
): Promise<CancelExternalAvisResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = CancelExternalSchema.safeParse({
      documentId:     formData.get('documentId'),
      transmissionId: formData.get('transmissionId'),
      reason:         formData.get('reason') || null,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    const doc = await db.document.findUnique({
      where: { id: parsed.data.documentId },
      select: { id: true, status: true, reference: true },
    });
    if (!doc) return { error: 'Document introuvable.' };

    const transmission = await db.externalTransmission.findUnique({
      where: { id: parsed.data.transmissionId },
      select: {
        id: true, documentId: true, status: true, recipient: true, recipientName: true,
      },
    });
    if (!transmission) return { error: 'Transmission externe introuvable.' };
    if (transmission.documentId !== doc.id) {
      return { error: 'Cette transmission ne correspond pas au document.' };
    }
    if (transmission.status !== 'PENDING') {
      return { error: `Cette transmission est déjà ${transmission.status} — annulation impossible.` };
    }

    const assignment = await findActiveAssignment(doc.id, role);
    if (!assignment) {
      return { error: 'Aucune affectation active pour votre rôle sur ce document.' };
    }

    if (doc.status !== 'AWAITING_EXTERNAL_AVIS') {
      return {
        error: `Statut inattendu : ${doc.status}. Le document n'est pas en attente d'avis externe.`,
      };
    }

    const effectiveRole = role === 'ADMIN' ? assignment.assignedToRole : role;
    const displayName =
      transmission.recipientName?.trim() || RECIPIENT_LABEL_FR[transmission.recipient];

    await db.$transaction(async (tx) => {
      await tx.externalTransmission.update({
        where: { id: transmission.id },
        data: { status: 'CANCELLED' },
      });

      await tx.comment.create({
        data: {
          documentId: doc.id,
          authorUserId: userId,
          authorRole: effectiveRole,
          body:
            `[Demande d'avis externe annulée → ${displayName}]` +
            (parsed.data.reason?.trim() ? `\n\nMotif : ${parsed.data.reason.trim()}` : ''),
        },
      });

      await tx.document.update({
        where: { id: doc.id },
        data: { status: 'IN_TREATMENT' },
      });

      await writeAudit(tx, {
        actorUserId: userId,
        entityType: 'document',
        entityId: doc.id,
        action: 'EXTERNAL_AVIS_CANCELLED',
        before: { status: 'AWAITING_EXTERNAL_AVIS' },
        after: { status: 'IN_TREATMENT', reference: doc.reference, byRole: effectiveRole, recipient: displayName },
      });
    });

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[cancelExternalAvis]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ----------------------------------------------------------------------------
//  Helper export — recipient labels for the UI picker
// ----------------------------------------------------------------------------

export async function getRecipientLabels(): Promise<Array<{ value: ExternalRecipient; label: string }>> {
  return RECIPIENT_VALUES.map((v) => ({ value: v, label: RECIPIENT_LABEL_FR[v] }));
}
