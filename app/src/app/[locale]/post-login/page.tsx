import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isStaffRole } from '@/lib/roles';

export const dynamic = 'force-dynamic';

/**
 * Silent router fired right after a successful sign-in.
 *
 * B22/B21-P5: restore the user's persisted language by redirecting to the
 * locale-prefixed dashboard derived from `User.locale`. We must NOT call
 * cookies().set() here — a Server Component cannot mutate cookies during
 * render (Next.js throws). The NEXT_LOCALE cookie is managed by the
 * LanguageSwitcher / updateMyLocale Server Actions instead; an explicit
 * locale prefix on this redirect is enough to land the user in the right
 * language, and next-intl's <Link> preserves it across in-app navigation.
 */
export default async function PostLoginPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login');

  if (!isStaffRole(session!.user!.role)) {
    redirect('/login');
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { locale: true },
  });
  const stored = user?.locale === 'en' ? 'en' : 'fr';

  // localePrefix is 'as-needed': FR (default) has no prefix, EN uses /en.
  redirect(stored === 'en' ? '/en/dashboard' : '/dashboard');
}
