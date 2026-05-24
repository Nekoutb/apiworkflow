import NextAuth from 'next-auth';
import { authConfig } from './lib/auth.config';

/**
 * Edge-safe middleware. Uses the lightweight authConfig
 * (no bcrypt, no Prisma) so it can run in the Edge runtime.
 */
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)'],
};
