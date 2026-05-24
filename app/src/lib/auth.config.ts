import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe Auth.js config — used by middleware.ts.
 * Must NOT import Node-only modules (bcryptjs, Prisma, etc.).
 * The actual Credentials provider with bcrypt lives in `auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  trustHost: true,
  providers: [], // populated in auth.ts for the Node side
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLoggedIn = !!auth?.user;

      // Public routes — always allowed
      // (/submit + /track land in B4 + B22; whitelisted now to avoid churn)
      const publicPaths = ['/', '/login', '/submit', '/track', '/api/auth'];
      const isPublic =
        publicPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
      if (isPublic) return true;

      // Everything else requires authentication
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      if (user) {
        if (user.id) token.id = user.id;
        if (user.role) token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id;
        if (token.role) session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
