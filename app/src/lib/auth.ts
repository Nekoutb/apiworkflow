import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { db } from './db';

/**
 * Auth.js v5 configuration.
 *
 * Providers (Phase 0): Credentials (email + password) only.
 * Phase 1 will add: TOTP 2FA challenge, optional Google/Microsoft OAuth.
 *
 * Session strategy: JWT (stateless) — simpler ops, no session table reads
 * on each request. Switch to "database" only if we need session revocation
 * lists or impersonation features.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').toLowerCase().trim();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;
        if (user.status !== 'ACTIVE') return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Phase 1 will read these in middleware to gate /staff vs /investor
          userType: user.userType,
          staffRole: user.staffRole,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // @ts-expect-error
        token.userType = user.userType;
        // @ts-expect-error
        token.staffRole = user.staffRole;
      }
      return token;
    },
    async session({ session, token }) {
      // Surface custom fields on session.user
      // @ts-expect-error
      session.user.userType = token.userType;
      // @ts-expect-error
      session.user.staffRole = token.staffRole;
      return session;
    },
  },
});
