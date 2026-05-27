'use server';

import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

// ============================================================================
//  B17 — Notification bell actions
//
//  Server actions for the universal notification bell shown in the header
//  of every authenticated page. The bell fetches recent notifications for
//  the current user (unread first), and the user can mark them read
//  individually or all at once.
//
//  Notification creation itself happens INSIDE the workflow actions
//  (DG dispatch, submitToDgForDecision, dgDecide, etc.) — see
//  `notify.ts` for the shared writer helper used by those actions.
// ============================================================================

export type NotificationView = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export type GetNotificationsResult = {
  ok?: boolean;
  error?: string;
  unreadCount?: number;
  items?: NotificationView[];
};

export async function getMyNotifications(): Promise<GetNotificationsResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'Non authentifié.' };

    const userId = session.user.id;
    const [items, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { forUserId: userId },
        orderBy: [{ read: 'asc' }, { createdAt: 'desc' }],
        take: 20,
        select: {
          id: true,
          kind: true,
          title: true,
          body: true,
          link: true,
          read: true,
          createdAt: true,
        },
      }),
      db.notification.count({
        where: { forUserId: userId, read: false },
      }),
    ]);

    return {
      ok: true,
      unreadCount,
      items: items.map((n) => ({
        ...n,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    console.error('[getMyNotifications]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

export type MarkReadResult = { ok?: boolean; error?: string };

export async function markNotificationRead(id: string): Promise<MarkReadResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'Non authentifié.' };

    await db.notification.updateMany({
      where: { id, forUserId: session.user.id, read: false },
      data: { read: true },
    });

    // Note: NO revalidatePath here. The bell maintains its own client-side
    // state (setItems / setUnread inside the bell component), and triggering
    // a global revalidate while the browser is also navigating to the
    // notification's deep link causes a brief flash of stale UI during
    // the action's response/redirect handshake.
    return { ok: true };
  } catch (e) {
    console.error('[markNotificationRead]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

export async function markAllNotificationsRead(): Promise<MarkReadResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { error: 'Non authentifié.' };

    await db.notification.updateMany({
      where: { forUserId: session.user.id, read: false },
      data: { read: true },
    });

    // Same rationale as markNotificationRead — no revalidatePath needed,
    // the bell updates its own state.
    return { ok: true };
  } catch (e) {
    console.error('[markAllNotificationsRead]', e);
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
