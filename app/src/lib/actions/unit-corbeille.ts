'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  Server actions for /unit/corbeille (B11)
//
//  Two actions per assignment:
//    1. markInTreatment  →  ASSIGNED → IN_TREATMENT
//                           Pure status flip, no Handoff (intra-unit).
//                           Records the user as currentHolderUserId so the
//                           document is now "owned" by them (not just their role).
//
//    2. returnToDg       →  ASSIGNED|IN_TREATMENT → AWAITING_DG_ANALYSIS
//                           Used when the unit decides the dispatch was wrong
//                           or they can't / shouldn't handle it.
//                           Creates a RETURN_TO_DG Handoff (transit via Courrier
//                           per B14.5) and marks the Assignment as RETURNED.
//                           DG re-opens the doc in their corbeille and re-routes.
//
//  Role gating:
//    - DG / DGA cannot use these (they have /dg/corbeille).
//    - ADMIN is allowed for testing — acts "on behalf of" the assigned role
//      for the specific document.
//    - Any other StaffRole may use the actions only on documents assigned to
//      THEIR role (the Assignment row's assignedToRole must match).
//
//  All transitions are atomic via db.$transaction().
// ============================================================================

const FORBIDDEN: StaffRole[] = ['DG', 'DGA'];

async function assertUnitMember(): Promise<{ id: string; role: StaffRole }> {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user || !role) throw new Error('UNAUTHORIZED');
  if (FORBIDDEN.includes(role)) throw new Error('UNAUTHORIZED');
  return { id: session.user.id!, role };
}

/**
 * Find the user's active assignment for this document.
 * ADMIN matches any active assignment.
 * Returns null if no matching assignment exists.
 */
async function findActiveAssignment(documentId: string, role: StaffRole) {
  if (role === 'ADMIN') {
    return db.assignment.findFirst({
      where: { documentId, status: 'ACTIVE' },
      orderBy: { assignedAt: 'desc' },
      select: { id: true, assignedToRole: true, instructions: true },
    });
  }
  return db.assignment.findFirst({
    where: { documentId, assignedToRole: role, status: 'ACTIVE' },
    orderBy: { assignedAt: 'desc' },
    select: { id: true, assignedToRole: true, instructions: true },
  });
}

// ----------------------------------------------------------------------------
//  markInTreatment
// ----------------------------------------------------------------------------

export type MarkInTreatmentResult = { ok?: boolean; error?: string };

export async function markInTreatment(documentId: string): Promise<MarkInTreatmentResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, reference: true, currentHolderUserId: true },
    });
    if (!doc) return { error: 'Document introuvable.' };

    const assignment = await findActiveAssignment(documentId, role);
    if (!assignment) {
      return {
        error: 'Aucune affectation active pour votre rôle sur ce document.',
      };
    }

    // Idempotent no-op if already in treatment.
    if (doc.status === 'IN_TREATMENT' && doc.currentHolderUserId === userId) {
      return { ok: true };
    }

    if (doc.status !== 'ASSIGNED' && doc.status !== 'IN_TREATMENT') {
      return {
        error: `Statut inattendu : ${doc.status}. Marquer en traitement n'est possible que sur les documents ASSIGNED ou IN_TREATMENT.`,
      };
    }

    const now = new Date();
    const effectiveRole =
      role === 'ADMIN' ? assignment.assignedToRole : role;

    await db.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          status: 'IN_TREATMENT',
          currentHolderRole: effectiveRole,
          currentHolderUserId: userId,
        },
      });

      await tx.comment.create({
        data: {
          documentId,
          authorUserId: userId,
          authorRole: effectiveRole,
          body:
            `[Prise en charge] Document pris en charge par ${roleLabel(effectiveRole)} ` +
            `(${now.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}).`,
        },
      });
    });

    revalidatePath('/unit/corbeille');
    revalidatePath(`/unit/corbeille/${documentId}`);
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès à la corbeille d\'unité.' };
    }
    console.error('[markInTreatment]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ----------------------------------------------------------------------------
//  returnToDg
// ----------------------------------------------------------------------------

export type ReturnToDgResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const ReturnSchema = z.object({
  documentId: z.string().min(1),
  reason:
    z.string({ required_error: 'Motif requis.' })
      .min(10, 'Motif trop court (10 caractères minimum).')
      .max(2000),
});

export async function returnToDg(
  _prev: ReturnToDgResult,
  formData: FormData,
): Promise<ReturnToDgResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = ReturnSchema.safeParse({
      documentId: formData.get('documentId'),
      reason:     formData.get('reason'),
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    const { documentId, reason } = parsed.data;

    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, reference: true },
    });
    if (!doc) return { error: 'Document introuvable.' };

    const assignment = await findActiveAssignment(documentId, role);
    if (!assignment) {
      return {
        error: 'Aucune affectation active pour votre rôle sur ce document.',
      };
    }

    if (doc.status !== 'ASSIGNED' && doc.status !== 'IN_TREATMENT') {
      return {
        error: `Statut inattendu : ${doc.status}. Le renvoi au DG n'est possible que sur les documents ASSIGNED ou IN_TREATMENT.`,
      };
    }

    const effectiveRole =
      role === 'ADMIN' ? assignment.assignedToRole : role;
    const now = new Date();

    await db.$transaction(async (tx) => {
      // 1. Mark the Assignment as RETURNED (closes it)
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: 'RETURNED', completedAt: now },
      });

      // 2. Create the RETURN_TO_DG handoff (transit via Service du Courrier · B14.5)
      await tx.handoff.create({
        data: {
          documentId,
          type: 'RETURN_TO_DG',
          fromRole: effectiveRole,
          fromUserId: userId,
          toRole: 'DG',
          reason:
            `${roleLabel(effectiveRole)} renvoie le document au DG via le Service du Courrier — ` +
            `motif : ${reason.trim()}`,
        },
      });

      // 3. Add a Comment with the unit's reason (visible to DG in /dg/corbeille/[id])
      await tx.comment.create({
        data: {
          documentId,
          authorUserId: userId,
          authorRole: effectiveRole,
          body: `[Renvoi au DG]\n\n${reason.trim()}`,
        },
      });

      // 4. Status transition — back to DG analysis queue
      await tx.document.update({
        where: { id: documentId },
        data: {
          status: 'AWAITING_DG_ANALYSIS',
          currentHolderRole: 'DG',
          currentHolderUserId: null,
          dispatchedAt: null, // reset so it goes back to the head of the FIFO age sort
        },
      });
    });

    revalidatePath('/unit/corbeille');
    revalidatePath(`/unit/corbeille/${documentId}`);
    revalidatePath('/dg/corbeille');
    revalidatePath(`/dg/corbeille/${documentId}`);
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès à la corbeille d\'unité.' };
    }
    console.error('[returnToDg]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
