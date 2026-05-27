import type { Prisma, StaffRole, NotificationKind } from '@prisma/client';
import { db } from '@/lib/db';

// ============================================================================
//  Shared notification writers (B17)
//
//  Used inside workflow server actions to create notifications atomically
//  as part of the same transaction. Two flavors:
//
//    notifyUser     — fire-and-forget for a single specific user.
//    notifyRole     — fan-out: one notification per active user with `role`.
//                     Skips the actor (so you don't notify yourself).
//
//  Both accept a Prisma TransactionClient OR a normal PrismaClient. Pass
//  the tx from within a $transaction block to keep the writes atomic with
//  the underlying workflow change.
// ============================================================================

type Tx = Prisma.TransactionClient | typeof db;

export type NotifyPayload = {
  documentId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  excludeUserId?: string; // typically the action's caller — don't notify them
};

/**
 * Notify a single specific user.
 */
export async function notifyUser(
  tx: Tx,
  userId: string,
  payload: NotifyPayload,
): Promise<void> {
  if (payload.excludeUserId && payload.excludeUserId === userId) return;
  await tx.notification.create({
    data: {
      forUserId: userId,
      documentId: payload.documentId,
      kind: payload.kind,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
    },
  });
}

/**
 * Notify every active user with the given role (one notification per user).
 * Skips the caller if `excludeUserId` matches.
 */
export async function notifyRole(
  tx: Tx,
  role: StaffRole,
  payload: NotifyPayload,
): Promise<number> {
  const users = await tx.user.findMany({
    where: {
      staffRole: role,
      status: 'ACTIVE',
      ...(payload.excludeUserId ? { NOT: { id: payload.excludeUserId } } : {}),
    },
    select: { id: true },
  });
  if (users.length === 0) return 0;
  await tx.notification.createMany({
    data: users.map((u) => ({
      forUserId: u.id,
      documentId: payload.documentId,
      kind: payload.kind,
      title: payload.title,
      body: payload.body ?? null,
      link: payload.link ?? null,
    })),
  });
  return users.length;
}
