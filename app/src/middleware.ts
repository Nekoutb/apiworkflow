import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { routing } from './i18n/routing';

/**
 * Middleware — next-intl only.
 *
 * Previously this wrapped Auth.js's `auth()` around the intl middleware, but
 * the combination produced an infinite redirect loop in Next.js 15.5 +
 * next-intl v4 + Auth.js v5-beta:
 *   GET /login → 307 with both `x-middleware-rewrite: /fr/login` AND
 *   `location: /login`  →  client follows location, loops forever
 *
 * Auth.js's authorized() callback was useful for centralised public-path
 * matching, but it isn't strictly necessary — every protected page already
 * calls `auth()` server-side:
 *   - [locale]/admin/layout.tsx   → redirect if not ADMIN
 *   - [locale]/dashboard/page.tsx → redirect if no session
 *   - [locale]/post-login/page.tsx → redirect if no session
 *   - [locale]/admin/users/page.tsx → second check redundant with layout
 *
 * Public routes (/, /login, /submit, /track) need no auth and are unaffected
 * by this simplification.
 */
const intlMiddleware = createIntlMiddleware(routing);

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Bypass routes that should never be touched by next-intl
  if (pathname === '/_health' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  return intlMiddleware(req);
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
