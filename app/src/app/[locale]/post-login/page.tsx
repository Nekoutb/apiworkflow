import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/**
 * Silent router fired right after a successful sign-in.
 *
 * v2 destinations (preliminary — final dashboards land in B5-B9):
 *   ADMIN                                → /dashboard
 *   DG / DGA                             → /dashboard (DG inbox arrives in B7)
 *   CHEF_BUREAU_ARRIVEE / DEPART / ARCH  → /dashboard (Courrier dashboards in B5-B6)
 *   any other staff role                 → /dashboard (corbeille rework in B9-B10)
 *   no recognised role                   → /login
 */
export default async function PostLoginPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  if (!isStaffRole(session.user.role)) {
    redirect('/login');
  }

  // For now everyone lands on /dashboard — it surfaces the v2 status.
  // The next-intl middleware adds the locale prefix on the redirect.
  redirect('/dashboard');
}
