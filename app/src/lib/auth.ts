import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { db } from './db';
import { authConfig } from './auth.config';

/**
 * Full Auth.js config — used by Server Components, Server Actions, route handlers.
 * Imports bcryptjs + Prisma which are Node-only.
 * Middleware uses `auth.config.ts` instead (Edge-safe).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Mot de passe', type: 'password' },
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
          // `role` carries either a StaffRole or the sentinel 'INVESTOR'.
          // Layout guards and /post-login routing both rely on this.
          role: user.staffRole ?? 'INVESTOR',
        };
      },
    }),
  ],
});
