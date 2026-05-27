'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { roleLabel, roleChildren, roleParent, isStaffRole } from '@/lib/roles';
import { coAvisReturnTarget, isDirectorPeer } from '@/lib/co-avis';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  Server actions for /unit/parapheur (B11)
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
//                           DG re-opens the doc in their parapheur and re-routes.
//
//  Role gating:
//    - DG / DGA cannot use these (they have /dg/parapheur).
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

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${documentId}`);
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
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

      // 3. Add a Comment with the unit's reason (visible to DG in /dg/parapheur/[id])
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

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${documentId}`);
    revalidatePath('/dg/parapheur');
    revalidatePath(`/dg/parapheur/${documentId}`);
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[returnToDg]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ============================================================================
//  B12 — Intra-department workflow
//
//  Two more actions that keep the document inside the same department,
//  moving along the organigramme hierarchy.
//
//    delegateDown  → VERTICAL_DOWN (Directeur → Sous-dir → Service)
//                    Target MUST be a direct child of the caller's role
//                    (roleChildren check). Document stays IN_TREATMENT,
//                    currentHolderRole updates, current Assignment is
//                    marked SUPERSEDED and a new ACTIVE one is created
//                    on the target.
//
//    returnUp      → RETURN_UP   (Service → Sous-dir → Directeur)
//                    Target = roleParent(caller). Refuses to fire if the
//                    parent is DG / DGA — that path is "Renvoyer au DG
//                    après traitement" (B15) or the existing refusal-style
//                    "Renvoyer au DG" (B11), not this one.
//
//  Both actions reuse the same auth + assignment lookup helpers from above,
//  including the ADMIN-acts-on-behalf-of-assigned-role pattern.
// ============================================================================

// ----------------------------------------------------------------------------
//  delegateDown
// ----------------------------------------------------------------------------

export type DelegateDownResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  targetRole?: StaffRole;
  targetLabel?: string;
};

const DelegateSchema = z.object({
  documentId: z.string().min(1),
  targetRole: z.string().refine(isStaffRole, 'Rôle cible invalide.'),
  message:    z.string().max(2000).optional().nullable(),
});

export async function delegateDown(
  _prev: DelegateDownResult,
  formData: FormData,
): Promise<DelegateDownResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = DelegateSchema.safeParse({
      documentId: formData.get('documentId'),
      targetRole: formData.get('targetRole'),
      message:    formData.get('message') || null,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    const targetRole = parsed.data.targetRole as StaffRole;
    if (FORBIDDEN.includes(targetRole) || targetRole === 'ADMIN') {
      return {
        fieldErrors: {
          targetRole:
            'Cible non autorisée (DG, DGA et ADMIN ne reçoivent pas de délégation interne).',
        },
      };
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
          `Statut inattendu : ${doc.status}. La délégation interne n'est possible ` +
          `que sur les documents ASSIGNED ou IN_TREATMENT.`,
      };
    }

    const effectiveRole = role === 'ADMIN' ? assignment.assignedToRole : role;

    // Organigramme constraint — target must be a direct child of the caller
    const children = roleChildren(effectiveRole);
    if (!children.includes(targetRole)) {
      return {
        fieldErrors: {
          targetRole:
            `${roleLabel(targetRole)} n'est pas un subordonné direct de ` +
            `${roleLabel(effectiveRole)} dans l'organigramme.`,
        },
      };
    }

    const now = new Date();
    const targetLabel = roleLabel(targetRole);
    const fromLabel = roleLabel(effectiveRole);

    await db.$transaction(async (tx) => {
      // 1. Mark current Assignment as SUPERSEDED
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: 'SUPERSEDED', completedAt: now },
      });

      // 2. New ACTIVE Assignment on the target child
      await tx.assignment.create({
        data: {
          documentId: doc.id,
          assignedToRole: targetRole,
          assignedByUserId: userId,
          assignedAt: now,
          instructions: parsed.data.message?.trim() || null,
          status: 'ACTIVE',
        },
      });

      // 3. VERTICAL_DOWN handoff
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'VERTICAL_DOWN',
          fromRole: effectiveRole,
          fromUserId: userId,
          toRole: targetRole,
          reason:
            `${fromLabel} délègue le dossier à ${targetLabel} ` +
            `(subordonné direct dans l'organigramme).`,
        },
      });

      // 4. Optional message → Comment
      if (parsed.data.message && parsed.data.message.trim().length > 0) {
        await tx.comment.create({
          data: {
            documentId: doc.id,
            authorUserId: userId,
            authorRole: effectiveRole,
            body: `[Délégation interne → ${targetLabel}]\n\n${parsed.data.message.trim()}`,
          },
        });
      }

      // 5. Document — handed to child, status stays/becomes IN_TREATMENT
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'IN_TREATMENT',
          currentHolderRole: targetRole,
          currentHolderUserId: null, // not yet "taken" by an individual subordinate
        },
      });
    });

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    return { ok: true, targetRole, targetLabel };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[delegateDown]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ----------------------------------------------------------------------------
//  returnUp
// ----------------------------------------------------------------------------

export type ReturnUpResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  targetRole?: StaffRole;
  targetLabel?: string;
};

const ReturnUpSchema = z.object({
  documentId: z.string().min(1),
  message:    z.string().max(2000).optional().nullable(),
});

export async function returnUp(
  _prev: ReturnUpResult,
  formData: FormData,
): Promise<ReturnUpResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = ReturnUpSchema.safeParse({
      documentId: formData.get('documentId'),
      message:    formData.get('message') || null,
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

    const assignment = await findActiveAssignment(doc.id, role);
    if (!assignment) {
      return { error: 'Aucune affectation active pour votre rôle sur ce document.' };
    }

    if (doc.status !== 'ASSIGNED' && doc.status !== 'IN_TREATMENT') {
      return {
        error:
          `Statut inattendu : ${doc.status}. Le renvoi au supérieur n'est possible ` +
          `que sur les documents ASSIGNED ou IN_TREATMENT.`,
      };
    }

    const effectiveRole = role === 'ADMIN' ? assignment.assignedToRole : role;
    const parentRole = roleParent(effectiveRole);

    if (!parentRole) {
      return {
        error: `${roleLabel(effectiveRole)} n'a pas de supérieur direct dans l'organigramme.`,
      };
    }
    if (parentRole === 'DG' || parentRole === 'DGA') {
      return {
        error:
          'Pour renvoyer au DG, utilisez le bouton « Renvoyer au DG ». ' +
          'Le renvoi au supérieur direct est réservé aux niveaux Service → Sous-Direction → Direction.',
      };
    }

    const now = new Date();
    const fromLabel = roleLabel(effectiveRole);
    const targetLabel = roleLabel(parentRole);

    await db.$transaction(async (tx) => {
      // 1. Mark current Assignment as SUPERSEDED
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: 'SUPERSEDED', completedAt: now },
      });

      // 2. New ACTIVE Assignment on parent
      await tx.assignment.create({
        data: {
          documentId: doc.id,
          assignedToRole: parentRole,
          assignedByUserId: userId,
          assignedAt: now,
          instructions: parsed.data.message?.trim() || null,
          status: 'ACTIVE',
        },
      });

      // 3. RETURN_UP handoff
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'RETURN_UP',
          fromRole: effectiveRole,
          fromUserId: userId,
          toRole: parentRole,
          reason:
            `${fromLabel} renvoie le dossier à ${targetLabel} ` +
            `(supérieur hiérarchique direct).`,
        },
      });

      // 4. Optional message → Comment (the avis from the subordinate)
      if (parsed.data.message && parsed.data.message.trim().length > 0) {
        await tx.comment.create({
          data: {
            documentId: doc.id,
            authorUserId: userId,
            authorRole: effectiveRole,
            body: `[Renvoi au supérieur → ${targetLabel}]\n\n${parsed.data.message.trim()}`,
          },
        });
      }

      // 5. Document — handed to parent, status stays IN_TREATMENT
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'IN_TREATMENT',
          currentHolderRole: parentRole,
          currentHolderUserId: null,
        },
      });
    });

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    return { ok: true, targetRole: parentRole, targetLabel };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[returnUp]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ============================================================================
//  B13 — Horizontal co-avis between Directeur peers
//
//  Two actions, both using the HORIZONTAL HandoffType:
//
//    requestCoAvis  → A Directeur-level role asks a peer (also Directeur-level)
//                     for an opinion. Document changes hands but stays IN
//                     the broader workflow — the receiving Directeur can
//                     delegate down within their own department, then
//                     ultimately use returnCoAvis to send it back with
//                     their compiled avis.
//
//    returnCoAvis   → The peer Directeur (who has finished forming their
//                     opinion) sends the document BACK to the original
//                     requester. Target is derived from the doc's handoff
//                     history via coAvisReturnTarget (stack-paired). Refuses
//                     to fire if the caller isn't actually the target of an
//                     open co-avis request.
//
//  Both keep the document at IN_TREATMENT — co-avis is intra-workflow, not
//  a DG-level state transition.
// ============================================================================

const DIRECTOR_PEER_NOT_ALLOWED_AS_TARGET: StaffRole[] = ['DG', 'DGA', 'ADMIN'];

// ----------------------------------------------------------------------------
//  requestCoAvis
// ----------------------------------------------------------------------------

export type RequestCoAvisResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  targetRole?: StaffRole;
  targetLabel?: string;
};

const RequestCoAvisSchema = z.object({
  documentId: z.string().min(1),
  targetRole: z.string().refine(isStaffRole, 'Pair invalide.'),
  message:    z.string().max(2000).optional().nullable(),
});

export async function requestCoAvis(
  _prev: RequestCoAvisResult,
  formData: FormData,
): Promise<RequestCoAvisResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = RequestCoAvisSchema.safeParse({
      documentId: formData.get('documentId'),
      targetRole: formData.get('targetRole'),
      message:    formData.get('message') || null,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    const targetRole = parsed.data.targetRole as StaffRole;
    if (DIRECTOR_PEER_NOT_ALLOWED_AS_TARGET.includes(targetRole)) {
      return {
        fieldErrors: {
          targetRole: 'Cible non autorisée pour un co-avis (DG, DGA, ADMIN exclus).',
        },
      };
    }
    if (!isDirectorPeer(targetRole)) {
      return {
        fieldErrors: {
          targetRole:
            `${roleLabel(targetRole)} n'est pas au niveau Directeur (parent direct du DG). ` +
            `Le co-avis horizontal n'est valable qu'entre rôles rattachés au DG.`,
        },
      };
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
          `Statut inattendu : ${doc.status}. Une demande de co-avis n'est possible ` +
          `que sur les documents ASSIGNED ou IN_TREATMENT.`,
      };
    }

    const effectiveRole = role === 'ADMIN' ? assignment.assignedToRole : role;
    if (!isDirectorPeer(effectiveRole)) {
      return {
        error:
          `${roleLabel(effectiveRole)} n'est pas au niveau Directeur. ` +
          `Seuls les rôles rattachés directement au DG peuvent demander un co-avis.`,
      };
    }
    if (targetRole === effectiveRole) {
      return {
        fieldErrors: { targetRole: 'Vous ne pouvez pas vous demander un co-avis à vous-même.' },
      };
    }

    const now = new Date();
    const fromLabel = roleLabel(effectiveRole);
    const targetLabel = roleLabel(targetRole);

    await db.$transaction(async (tx) => {
      // 1. Mark current Assignment as SUPERSEDED
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: 'SUPERSEDED', completedAt: now },
      });

      // 2. New ACTIVE Assignment on the peer Directeur — tagged so they
      //    know it's a co-avis request and not a regular dispatch.
      await tx.assignment.create({
        data: {
          documentId: doc.id,
          assignedToRole: targetRole,
          assignedByUserId: userId,
          assignedAt: now,
          instructions:
            `[Co-avis demandé par ${fromLabel}] ` +
            (parsed.data.message?.trim()
              ? parsed.data.message.trim()
              : 'Merci de produire votre avis sur ce dossier.'),
          status: 'ACTIVE',
        },
      });

      // 3. HORIZONTAL handoff
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'HORIZONTAL',
          fromRole: effectiveRole,
          fromUserId: userId,
          toRole: targetRole,
          reason:
            `${fromLabel} demande un co-avis à ${targetLabel} ` +
            `(transfert horizontal entre pairs Directeurs).`,
        },
      });

      // 4. Optional message → standalone Comment too (visible to the receiver)
      if (parsed.data.message && parsed.data.message.trim().length > 0) {
        await tx.comment.create({
          data: {
            documentId: doc.id,
            authorUserId: userId,
            authorRole: effectiveRole,
            body: `[Demande de co-avis → ${targetLabel}]\n\n${parsed.data.message.trim()}`,
          },
        });
      }

      // 5. Document: stays IN_TREATMENT, holder = peer
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'IN_TREATMENT',
          currentHolderRole: targetRole,
          currentHolderUserId: null,
        },
      });
    });

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    return { ok: true, targetRole, targetLabel };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[requestCoAvis]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ----------------------------------------------------------------------------
//  returnCoAvis
// ----------------------------------------------------------------------------

export type ReturnCoAvisResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  targetRole?: StaffRole;
  targetLabel?: string;
};

const ReturnCoAvisSchema = z.object({
  documentId: z.string().min(1),
  message:    z.string().max(2000).optional().nullable(),
});

export async function returnCoAvis(
  _prev: ReturnCoAvisResult,
  formData: FormData,
): Promise<ReturnCoAvisResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = ReturnCoAvisSchema.safeParse({
      documentId: formData.get('documentId'),
      message:    formData.get('message') || null,
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

    const assignment = await findActiveAssignment(doc.id, role);
    if (!assignment) {
      return { error: 'Aucune affectation active pour votre rôle sur ce document.' };
    }

    if (doc.status !== 'ASSIGNED' && doc.status !== 'IN_TREATMENT') {
      return {
        error:
          `Statut inattendu : ${doc.status}. Le retour d'un co-avis n'est possible ` +
          `que sur les documents ASSIGNED ou IN_TREATMENT.`,
      };
    }

    const effectiveRole = role === 'ADMIN' ? assignment.assignedToRole : role;

    // Compute the return target from the doc's handoff history
    const handoffs = await db.handoff.findMany({
      where: { documentId: doc.id },
      orderBy: { createdAt: 'asc' },
      select: { type: true, fromRole: true, toRole: true, createdAt: true },
    });
    const target = coAvisReturnTarget(handoffs, effectiveRole);

    if (!target) {
      return {
        error:
          'Aucun co-avis ouvert ne vous est destiné sur ce document. ' +
          'Utilisez plutôt « Renvoyer au DG » ou « Renvoyer au supérieur ».',
      };
    }

    const now = new Date();
    const fromLabel = roleLabel(effectiveRole);
    const targetLabel = roleLabel(target);

    await db.$transaction(async (tx) => {
      // 1. Mark current Assignment as SUPERSEDED
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: 'SUPERSEDED', completedAt: now },
      });

      // 2. New ACTIVE Assignment on the original requester
      await tx.assignment.create({
        data: {
          documentId: doc.id,
          assignedToRole: target,
          assignedByUserId: userId,
          assignedAt: now,
          instructions:
            `[Co-avis reçu de ${fromLabel}] ` +
            (parsed.data.message?.trim() || 'Avis transmis — voir notes du dossier.'),
          status: 'ACTIVE',
        },
      });

      // 3. HORIZONTAL handoff (return direction)
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'HORIZONTAL',
          fromRole: effectiveRole,
          fromUserId: userId,
          toRole: target,
          reason:
            `${fromLabel} retourne son co-avis à ${targetLabel} ` +
            `(retour horizontal après formation de l'avis).`,
        },
      });

      // 4. The co-avis itself — always recorded as a Comment, even when no
      //    message was typed (since the avis IS the point of the action).
      await tx.comment.create({
        data: {
          documentId: doc.id,
          authorUserId: userId,
          authorRole: effectiveRole,
          body:
            `[Co-avis de ${fromLabel} → ${targetLabel}]\n\n` +
            (parsed.data.message?.trim() ||
              '(Aucun texte joint — voir notes internes et pièces du dossier.)'),
        },
      });

      // 5. Document: stays IN_TREATMENT, holder = original requester
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'IN_TREATMENT',
          currentHolderRole: target,
          currentHolderUserId: null,
        },
      });
    });

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    return { ok: true, targetRole: target, targetLabel };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[returnCoAvis]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ============================================================================
//  B15 — Final submission to DG for decision
//
//  After the department has finished its analysis (delegation chain wrapped up,
//  any co-avis received, any external avis recorded), the Directeur-level role
//  holding the file submits it to the DG for the final decision.
//
//  This is NOT the same as B11's "Renvoyer au DG" (refusal). Distinction:
//
//    B11 returnToDg              → AWAITING_DG_ANALYSIS   (DG re-routes)
//    B15 submitToDgForDecision   → AWAITING_DG_DECISION   (DG decides)
//
//  Both use the RETURN_TO_DG handoff type, distinguished by the handoff's
//  `reason` text and the target status.
//
//  Auth: caller must be at Directeur level (roleParent === DG). Lower-level
//  roles cannot submit directly — they must return up the chain first (B12).
// ============================================================================

export type SubmitToDgResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

const SubmitToDgSchema = z.object({
  documentId:    z.string().min(1),
  recommendation:
    z.string({ required_error: 'Recommandation requise.' })
      .min(10, 'Recommandation trop courte (10 caractères minimum).')
      .max(4000),
});

export async function submitToDgForDecision(
  _prev: SubmitToDgResult,
  formData: FormData,
): Promise<SubmitToDgResult> {
  try {
    const { id: userId, role } = await assertUnitMember();

    const parsed = SubmitToDgSchema.safeParse({
      documentId:     formData.get('documentId'),
      recommendation: formData.get('recommendation'),
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

    const assignment = await findActiveAssignment(doc.id, role);
    if (!assignment) {
      return { error: 'Aucune affectation active pour votre rôle sur ce document.' };
    }

    if (doc.status !== 'ASSIGNED' && doc.status !== 'IN_TREATMENT') {
      return {
        error:
          `Statut inattendu : ${doc.status}. La soumission au DG pour décision n'est possible ` +
          `que sur les documents ASSIGNED ou IN_TREATMENT.`,
      };
    }

    const effectiveRole = role === 'ADMIN' ? assignment.assignedToRole : role;

    if (!isDirectorPeer(effectiveRole)) {
      return {
        error:
          `${roleLabel(effectiveRole)} n'est pas au niveau Directeur. ` +
          `Seuls les rôles rattachés directement au DG peuvent soumettre un dossier pour ` +
          `décision finale. Renvoyez d'abord à votre supérieur (B12).`,
      };
    }

    const now = new Date();
    const fromLabel = roleLabel(effectiveRole);

    await db.$transaction(async (tx) => {
      // 1. Mark current Assignment as COMPLETED — work is done
      await tx.assignment.update({
        where: { id: assignment.id },
        data: { status: 'COMPLETED', completedAt: now },
      });

      // 2. RETURN_TO_DG handoff — distinguished from B11 refusal by the reason
      //    text and by the fact that the target status will be AWAITING_DG_DECISION,
      //    not AWAITING_DG_ANALYSIS.
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'RETURN_TO_DG',
          fromRole: effectiveRole,
          fromUserId: userId,
          toRole: 'DG',
          reason:
            `${fromLabel} soumet le dossier au DG pour décision finale, ` +
            `après traitement par le département. Avis compilé joint en note interne.`,
        },
      });

      // 3. The compiled recommendation as a tagged Comment (visible to DG)
      await tx.comment.create({
        data: {
          documentId: doc.id,
          authorUserId: userId,
          authorRole: effectiveRole,
          body:
            `[Soumission au DG pour décision — recommandation de ${fromLabel}]\n\n` +
            parsed.data.recommendation.trim(),
        },
      });

      // 4. Document: status → AWAITING_DG_DECISION, holder = DG
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'AWAITING_DG_DECISION',
          currentHolderRole: 'DG',
          currentHolderUserId: null,
        },
      });
    });

    revalidatePath('/unit/parapheur');
    revalidatePath(`/unit/parapheur/${doc.id}`);
    revalidatePath('/dg/parapheur');
    revalidatePath(`/dg/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas accès au parapheur d\'unité.' };
    }
    console.error('[submitToDgForDecision]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
