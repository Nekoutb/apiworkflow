import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Route protection middleware.
 *
 * - /investor/** → requires a logged-in INVESTOR (or STAFF for admin oversight)
 * - /staff/**    → requires a logged-in STAFF user
 * - /login, /signup, /dispatch → always allowed
 * - everything else → public
 *
 * Unauthorised requests are redirected to /login with a ?next= param.
 *
 * Note: Auth.js v5 exposes auth() as middleware via `export { auth as middleware }`,
 * but we use the explicit form so we can add custom logic (role gating).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — always pass through
  if (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.svg' ||
    pathname === '/dispatch'
  ) {
    return NextResponse.next();
  }

  const session = await auth();

  // Protected: must be logged in
  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Role gating
  // @ts-expect-error custom session field
  const userType: string | undefined = session.user.userType;

  if (pathname.startsWith('/investor') && userType !== 'INVESTOR' && userType !== 'STAFF') {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  if (pathname.startsWith('/staff') && userType !== 'STAFF') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Apply to everything except static files
  matcher: ['/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'],
};
