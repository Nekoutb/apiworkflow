'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  Server actions for /courrier/archives (B6)
//
//  Roles allowed:
//    - ADMIN
//    - CHEF_BUREAU_ARCHIVES  (primary)
//    - CHEF_SERVICE_COURRIER (supervisor)
//
//  closeDocument: transitions a document from RESPONSE_SENT to CLOSED.
//  Once closed, the document is final — read-only forever after.
//
//  (Auto-closure after a retention window — e.g. 30 days post-response —
//  belongs to B22 / scheduled jobs. For now closure is manual.)
// ============================================================================

const ALLOWED_ROLES: StaffRole[] = [
  'ADMIN',
  'CHEF_BUREAU_ARCHIVES',
  'CHEF_SERVICE_COURRIER',
];

async function assertArchives(): Promise<{ id: string; role: StaffRole }> {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
    throw new Error('UNAUTHORIZED');
  }
  return { id: session.user.id!, role };
}

export type CloseResult = { ok?: boolean; error?: string };

export async function closeDocument(documentId: string): Promise<CloseResult> {
  try {
    const { id: userId, role } = await assertArchives();

    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, reference: true },
    });
    if (!doc) return { error: 'Document introuvable.' };
    if (doc.status !== 'RESPONSE_SENT') {
      return {
        error: `Statut inattendu : ${doc.status}. Seuls les documents au statut RESPONSE_SENT peuvent être clos.`,
      };
    }

    const now = new Date();
    await db.$transaction(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          status: 'CLOSED',
          closedAt: now,
          currentHolderRole: null,
          currentHolderUserId: null,
        },
      });

      await tx.handoff.create({
        data: {
          documentId,
          type: 'RESPONSE_OUT', // final transit handoff
          fromRole: 'CHEF_BUREAU_ARCHIVES',
          fromUserId: userId,
          toRole: null,
          reason: `Dossier clos et archivé par ${role === 'ADMIN' ? 'l\'administrateur' : 'le Bureau Archives'}.`,
        },
      });

      await tx.comment.create({
        data: {
          documentId,
          authorUserId: userId,
          authorRole: 'CHEF_BUREAU_ARCHIVES',
          body: `[Clôture] Dossier archivé le ${now.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}.`,
        },
      });
    });

    revalidatePath('/courrier/archives');
    revalidatePath('/courrier/depart');
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { error: 'Vous n\'avez pas les droits Bureau Archives.' };
    }
    console.error('[closeDocument]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
