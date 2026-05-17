/**
 * Module augmentation for NextAuth (Auth.js v5)
 * Adds our custom fields (userType, staffRole) onto Session and JWT.
 */
import type { UserType, StaffRole } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      userType?: UserType;
      staffRole?: StaffRole | null;
    };
  }

  interface User {
    id?: string;
    userType?: UserType;
    staffRole?: StaffRole | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    userType?: UserType;
    staffRole?: StaffRole | null;
  }
}
