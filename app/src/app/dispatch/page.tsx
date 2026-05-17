import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * Post-login dispatcher.
 * Reads the session and redirects to the correct portal based on user type.
 * Used as a redirectTo target by signIn() Server Action.
 */
export default async function DispatchPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  // @ts-expect-error custom session field
  const userType: string | undefined = session.user.userType;
  if (userType === 'STAFF') redirect('/staff');
  redirect('/investor');
}

// Disable static generation — this page reads the session
export const dynamic = 'force-dynamic';
