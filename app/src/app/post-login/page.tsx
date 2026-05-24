import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Silent router fired right after a successful sign-in.
 *
 * Decision tree:
 *   STAFF    →  /dashboard
 *   INVESTOR + no conventions yet         →  /investor/new
 *   INVESTOR + at least one convention    →  /investor
 *                 (existing investors will see their convention card)
 */
export default async function PostLoginPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const userId = session.user.id;

  // Staff users have a non-INVESTOR role — anything except the sentinel.
  if (session.user.role && session.user.role !== 'INVESTOR') {
    // ADMIN gets the admin dashboard; workflow staff land on their corbeille.
    redirect(session.user.role === 'ADMIN' ? '/dashboard' : '/staff/inbox');
  }

  // Investor branch — figure out where to land based on the Investor row.
  const investor = await db.investor.findUnique({
    where: { userId },
    include: { _count: { select: { conventions: true } } },
  });

  if (!investor) {
    // Investor user without an Investor row (e.g. created manually).
    // Send them to /investor — that page surfaces a friendly error.
    redirect('/investor');
  }

  if (investor._count.conventions === 0 && !investor.isExisting) {
    redirect('/investor/new');
  }

  redirect('/investor');
}
