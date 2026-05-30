'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import { getStaffScope, canAccessDocument } from '@/lib/visibility';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  B16 + B20 — Reminder nudges from "État des dossiers"
//
//  The État des dossiers console (formerly /secretariat) shows pending
//  dossiers with their wait time against the 72h government SLA. The
//  "Send reminder" button on each row triggers this action.
//
//  Behavior:
//    - Creates a REMINDER_NUDGE notification for the current holder
//      (if there's a specific user) or for ALL active users with the
//      current holder role (if the doc is held at the role level).
//    - Adds a tagged Comment to the document so the reminder is in the
//      audit trail.
//
//  Auth (B20 update): any staff member whose visibility scope includes
//  the document. Privileged roles (SECRETARIAT_DG, CHEF_SERVICE_COURRIER,
//  DG, DGA, ADMIN) pass automatically via hasFullVisibility. Scoped
//  roles pass when the doc was assigned to / handed off from / sent for
//  external avis by their role or any subordinate role.
// ============================================================================

async function assertReminderSender(
  documentId: string,
): Promise<{ id: string; role: StaffRole }> {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user || !role) throw new Error('UNAUTHORIZED');
  const scope = getStaffScope(session);
  if (!scope) throw new Error('UNAUTHORIZED');
  const ok = await canAccessDocument(documentId, scope);
  if (!ok) throw new Error('UNAUTHORIZED');
  return { id: session.user.id!, role };
}

export type SendReminderResult = {
  ok?: boolean;
  error?: string;
  recipients?: number;
};

export async function sendReminder(documentId: string): Promise<SendReminderResult> {
  try {
    const { id: senderId, role: senderRole } = await assertReminderSender(documentId);

    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        reference: true,
        subject: true,
        status: true,
        currentHolderRole: true,
        currentHolderUserId: true,
      },
    });
    if (!doc) return { error: 'Document introuvable.' };

    if (!doc.currentHolderRole) {
      return { error: 'Ce document n\'a pas de détenteur courant — rappel impossible.' };
    }

    // Determine who to notify: the specific user holding it, or every
    // active user with the current holder role.
    const recipientIds = doc.currentHolderUserId
      ? [doc.currentHolderUserId]
      : (await db.user.findMany({
          where: { staffRole: doc.currentHolderRole, status: 'ACTIVE' },
          select: { id: true },
        })).map((u) => u.id);

    if (recipientIds.length === 0) {
      return {
        error:
          `Aucun utilisateur actif avec le rôle ${roleLabel(doc.currentHolderRole)} ` +
          `— rappel non livré.`,
      };
    }

    // Sender label: any role can send a reminder if the doc is in their
    // visibility scope. Use the role's official label.
    const senderLabel = roleLabel(senderRole);
    const holderLabel = roleLabel(doc.currentHolderRole);

    // Deep link to the right page based on holder role
    const link = doc.currentHolderRole === 'DG' || doc.currentHolderRole === 'DGA'
      ? `/dg/parapheur/${doc.id}`
      : doc.currentHolderRole === 'CHEF_BUREAU_DEPART'
        ? `/courrier/depart/${doc.id}`
        : `/unit/parapheur/${doc.id}`;

    const title = `Rappel · ${doc.reference} en attente d'action`;
    const body =
      `${senderLabel} vous demande de traiter ce dossier sans délai. ` +
      `Statut actuel : ${doc.status}. Objet : ${doc.subject.slice(0, 120)}${doc.subject.length > 120 ? '…' : ''}`;

    await db.$transaction(async (tx) => {
      // 1. One Notification per recipient
      for (const userId of recipientIds) {
        await tx.notification.create({
          data: {
            forUserId: userId,
            documentId: doc.id,
            kind: 'REMINDER_NUDGE',
            title,
            body,
            link,
          },
        });
      }

      // 2. Tagged Comment in the document audit trail
      await tx.comment.create({
        data: {
          documentId: doc.id,
          authorUserId: senderId,
          authorRole: senderRole,
          body:
            `[Rappel envoyé par ${senderLabel} → ${holderLabel}]\n\n` +
            `${recipientIds.length} destinataire${recipientIds.length > 1 ? 's' : ''} notifié${recipientIds.length > 1 ? 's' : ''}.`,
        },
      });
    });

    revalidatePath('/secretariat');
    revalidatePath(`/dg/parapheur/${doc.id}`);
    revalidatePath(`/unit/parapheur/${doc.id}`);
    return { ok: true, recipients: recipientIds.length };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Ce dossier n\'est pas dans votre périmètre de visibilité — rappel impossible.' };
    }
    console.error('[sendReminder]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
