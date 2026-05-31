import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/**
 * Silent router fired right after a successful sign-in.
 *
 * B22/B21-P5: before redirecting, sync the NEXT_LOCALE cookie from the
 * user's persisted `User.locale` so their language choice follows them
 * across sessions and devices. next-intl then renders /dashboard in the
 * stored locale.
 */
export default async function PostLoginPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login');

  if (!isStaffRole(session!.user!.role)) {
    redirect('/login');
  }

  // Pull stored locale (default 'fr') and mirror into the cookie next-intl reads.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  const stored = user?.locale === 'en' ? 'en' : 'fr';
  const jar = await cookies();
  jar.set('NEXT_LOCALE', stored, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  // next-intl middleware applies the locale prefix on the redirect.
  redirect('/dashboard');
}
