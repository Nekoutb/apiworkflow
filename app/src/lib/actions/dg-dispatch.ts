'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { isStaffRole, roleLabel } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  Server action: DG dispatches a document to a chosen organigramme unit (B8).
//
//  Per B14.5 (Courrier-transit rule, R0bis), every DG ↔ Direction movement
//  must transit via the Service du Courrier. We honour this by:
//    - The Handoff record's `reason` explicitly mentions "via Service du
//      Courrier" so the audit trail is unambiguous
//    - The status transitions in one move (AWAITING_DG_ANALYSIS → ASSIGNED)
//      to keep the UX clean; the transit is metadata, not a separate state
//    - An Assignment row is created on the target role (the receiving
//      Direction's chef appears in their parapheur — B11)
//
//  Status transition:
//    AWAITING_DG_ANALYSIS  →  ASSIGNED
//    currentHolderRole     = <target>
//    dispatchedAt          = now
//
//  DG can either accept the AI suggestion (from B7's cached AiAnalysis) or
//  override via the grouped role picker. Either way, the target StaffRole
//  is validated against the 37-role enum before the action proceeds.
// ============================================================================

const ALLOWED_DG_ROLES: StaffRole[] = ['DG', 'DGA', 'ADMIN'];

async function assertDg(): Promise<{ id: string; role: StaffRole }> {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user || !role || !ALLOWED_DG_ROLES.includes(role)) {
    throw new Error('UNAUTHORIZED');
  }
  return { id: session.user.id!, role };
}

// Some StaffRole values shouldn't be dispatch targets (DG/DGA/ADMIN itself)
const NON_DISPATCHABLE: Set<StaffRole> = new Set(['DG', 'DGA', 'ADMIN']);

export type DispatchResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  targetRole?: StaffRole;
  targetLabel?: string;
};

const DispatchSchema = z.object({
  documentId: z.string().min(1),
  targetRole: z.string().refine(isStaffRole, 'Rôle cible invalide.'),
  instructions: z.string().max(2000).optional().nullable(),
  acceptedSuggestion: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .default('false'),
});

export async function dispatchToUnit(
  _prev: DispatchResult,
  formData: FormData,
): Promise<DispatchResult> {
  try {
    const { id: userId, role: dgRole } = await assertDg();

    const parsed = DispatchSchema.safeParse({
      documentId:         formData.get('documentId'),
      targetRole:         formData.get('targetRole'),
      instructions:       formData.get('instructions') || null,
      acceptedSuggestion: formData.get('acceptedSuggestion') ?? 'false',
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
    if (NON_DISPATCHABLE.has(targetRole)) {
      return {
        fieldErrors: {
          targetRole:
            'Cible non autorisée : DG, DGA et ADMIN ne peuvent pas recevoir de dispatch direct.',
        },
      };
    }

    // ---- Load + validate document ----
    const doc = await db.document.findUnique({
      where: { id: parsed.data.documentId },
      select: {
        id: true,
        reference: true,
        subject: true,
        status: true,
      },
    });
    if (!doc) return { error: 'Document introuvable.' };
    if (doc.status !== 'AWAITING_DG_ANALYSIS') {
      return {
        error: `Statut inattendu : ${doc.status}. Seuls les documents au statut AWAITING_DG_ANALYSIS peuvent être dispatchés depuis le parapheur DG.`,
      };
    }

    const accepted = parsed.data.acceptedSuggestion === 'true';
    const now = new Date();
    const targetLabel = roleLabel(targetRole);
    const dispatcher = dgRole === 'DG' ? 'Directeur Général' :
                       dgRole === 'DGA' ? 'Directeur Général Adjoint' :
                       'Administrateur';

    // ---- Write everything in a transaction ----
    await db.$transaction(async (tx) => {
      // 1. The dispatch handoff
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'DG_DISPATCH',
          fromRole: dgRole === 'ADMIN' ? 'DG' : dgRole, // ADMIN dispatches "as DG"
          fromUserId: userId,
          toRole: targetRole,
          reason:
            accepted
              ? `${dispatcher} valide la suggestion IA et dispatche vers ${targetLabel} via le Service du Courrier.`
              : `${dispatcher} dispatche vers ${targetLabel} via le Service du Courrier (cible choisie manuellement).`,
        },
      });

      // 2. The Assignment row — surfaces the doc in the target unit's parapheur (B11)
      await tx.assignment.create({
        data: {
          documentId: doc.id,
          assignedToRole: targetRole,
          assignedByUserId: userId,
          assignedAt: now,
          instructions: parsed.data.instructions?.trim() || null,
          status: 'ACTIVE',
        },
      });

      // 3. Optional instructions stored as a Comment too (visible in detail page)
      if (parsed.data.instructions && parsed.data.instructions.trim().length > 0) {
        await tx.comment.create({
          data: {
            documentId: doc.id,
            authorUserId: userId,
            authorRole: dgRole === 'ADMIN' ? 'DG' : dgRole,
            body: `[Instructions du DG]\n\n${parsed.data.instructions.trim()}`,
          },
        });
      }

      // 4. Status transition
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'ASSIGNED',
          dispatchedAt: now,
          currentHolderRole: targetRole,
        },
      });
    });

    revalidatePath('/dg/parapheur');
    revalidatePath(`/dg/parapheur/${doc.id}`);
    revalidatePath('/admin/data');
    // The receiving unit's parapheur (B11 — per-direction parapheur)
    // doesn't exist yet, this is the future revalidation target.
    revalidatePath('/unit/parapheur');

    return { ok: true, targetRole, targetLabel };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas les droits DG.' };
    }
    console.error('[dispatchToUnit]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
