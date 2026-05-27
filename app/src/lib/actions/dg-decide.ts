'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import { notifyRole } from '@/lib/notify';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  B15 — DG decision on a document submitted for final ruling
//
//  After a Directeur-level role submits a dossier via submitToDgForDecision
//  (B15), the document is at AWAITING_DG_DECISION. The DG (or DGA, ADMIN)
//  reviews everything and renders the decision:
//
//    APPROVED  → favorable (dossier validé · prêt pour expédition Bureau Départ)
//    REJECTED  → défavorable (dossier rejeté · lettre de refus à composer)
//
//  Either outcome transitions the document to DECIDED. From there Bureau
//  Départ (B5) takes over: composeResponse + sendResponse + email expédition.
//
//  The decision text is recorded as a tagged Comment so it's surfaced
//  everywhere in the audit trail. A DG_TO_COURRIER handoff transfers the
//  document to CHEF_BUREAU_DEPART (currentHolderRole).
//
//  Auth: DG, DGA, or ADMIN. (No "acting as" pattern needed — DG decides
//  always as DG.)
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

export type DgDecideResult = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  decision?: 'APPROVED' | 'REJECTED';
};

const DecideSchema = z.object({
  documentId: z.string().min(1),
  decision:   z.enum(['APPROVED', 'REJECTED']),
  message:
    z.string({ required_error: 'Justification requise.' })
      .min(10, 'Justification trop courte (10 caractères minimum).')
      .max(4000),
});

export async function dgDecide(
  _prev: DgDecideResult,
  formData: FormData,
): Promise<DgDecideResult> {
  try {
    const { id: userId, role: dgRole } = await assertDg();

    const parsed = DecideSchema.safeParse({
      documentId: formData.get('documentId'),
      decision:   formData.get('decision'),
      message:    formData.get('message'),
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

    if (doc.status !== 'AWAITING_DG_DECISION') {
      return {
        error:
          `Statut inattendu : ${doc.status}. Seuls les documents au statut ` +
          `AWAITING_DG_DECISION peuvent être tranchés.`,
      };
    }

    const now = new Date();
    const decision = parsed.data.decision;
    const decisionLabelFr = decision === 'APPROVED' ? 'APPROUVÉ' : 'REJETÉ';
    const dgLabel =
      dgRole === 'DG'  ? 'Directeur Général' :
      dgRole === 'DGA' ? 'Directeur Général Adjoint' :
                         'Administrateur';
    const handoffFromRole = dgRole === 'ADMIN' ? 'DG' : dgRole;

    await db.$transaction(async (tx) => {
      // 1. DG_TO_COURRIER handoff — routes to Bureau Départ
      await tx.handoff.create({
        data: {
          documentId: doc.id,
          type: 'DG_TO_COURRIER',
          fromRole: handoffFromRole,
          fromUserId: userId,
          toRole: 'CHEF_BUREAU_DEPART',
          reason:
            `${dgLabel} rend la décision : ${decisionLabelFr}. ` +
            `Transmis au Bureau Départ pour expédition de la réponse à l'émetteur.`,
        },
      });

      // 2. Decision text as a tagged Comment
      await tx.comment.create({
        data: {
          documentId: doc.id,
          authorUserId: userId,
          authorRole: handoffFromRole,
          body:
            `[Décision DG — ${decisionLabelFr}]\n\n` +
            parsed.data.message.trim(),
        },
      });

      // 3. Document: status → DECIDED, holder = Bureau Départ
      await tx.document.update({
        where: { id: doc.id },
        data: {
          status: 'DECIDED',
          decidedAt: now,
          currentHolderRole: 'CHEF_BUREAU_DEPART',
          currentHolderUserId: null,
        },
      });

      // 4. Notify Bureau Départ (they need to compose the response now)
      await notifyRole(tx, 'CHEF_BUREAU_DEPART', {
        documentId: doc.id,
        kind: 'DG_DECISION_MADE',
        title: `Décision DG · ${decisionLabelFr} : ${doc.reference}`,
        body: `${dgLabel} a tranché. Composez la lettre de réponse et expédiez à l'émetteur.`,
        link: `/courrier/depart/${doc.id}`,
        excludeUserId: userId,
      });
    });

    revalidatePath('/dg/parapheur');
    revalidatePath(`/dg/parapheur/${doc.id}`);
    revalidatePath('/courrier/depart');
    revalidatePath('/admin/data');
    return { ok: true, decision };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas les droits DG.' };
    }
    console.error('[dgDecide]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
