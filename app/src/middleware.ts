import NextAuth from 'next-auth';
import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfig } from './lib/auth.config';
import { routing } from './i18n/routing';

/**
 * Combined middleware: next-intl handles locale negotiation/prefix,
 * Auth.js handles session + route protection.
 *
 * Order matters: we run next-intl first (it may rewrite/redirect for locale)
 * then layer Auth.js on top of the resulting request.
 *
 * Both must stay Edge-safe (no bcrypt, no Prisma, no fs).
 */
const intlMiddleware = createIntlMiddleware(routing);
const { auth } = NextAuth(authConfig);

// We export a Web Request handler. Auth.js wraps a callback that receives
// the request and is expected to return a Response (or void to let it pass).
export default auth(function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Routes that should NEVER be touched by next-intl:
  //    - /_health (monitoring)
  //    - /api/*   (route handlers, especially Auth.js callbacks)
  if (pathname === '/_health' || pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 2. Everything else flows through next-intl first (locale prefix,
  //    cookie detection, redirect to defaultLocale, etc.)
  return intlMiddleware(req);
});

export const config = {
  // Skip Next internals, _health, api, and static files
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
};
