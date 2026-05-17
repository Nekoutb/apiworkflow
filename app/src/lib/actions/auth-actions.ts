'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { signIn, signOut } from '@/lib/auth';
import { UserType } from '@prisma/client';

// =====================================================================
// SIGN-UP (investor only) — staff accounts created by admin out-of-band
// =====================================================================

const signupSchema = z.object({
  email: z.string().email("L'adresse email est invalide"),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  passwordConfirm: z.string(),
  fullName: z.string().min(2, 'Veuillez saisir votre nom complet'),
  raisonSociale: z.string().min(2, "Veuillez saisir la raison sociale de l'entreprise"),
  legalForm: z.string().optional(),
  niu: z.string().optional(),
  country: z.string().default('Cameroun'),
  contactPhone: z.string().optional(),
}).refine((d) => d.password === d.passwordConfirm, {
  message: 'Les deux mots de passe ne correspondent pas',
  path: ['passwordConfirm'],
});

export type SignupActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
  ok?: boolean;
};

export async function signupAction(_prev: SignupActionState, formData: FormData): Promise<SignupActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  const email = data.email.toLowerCase().trim();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { formError: 'Un compte existe déjà avec cette adresse email.' };
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  await db.user.create({
    data: {
      email,
      passwordHash,
      name: data.fullName,
      userType: UserType.INVESTOR,
      emailVerified: null, // emailed magic link verification can be added in Phase 2
      investorProfile: {
        create: {
          raisonSociale: data.raisonSociale,
          legalForm: data.legalForm || null,
          niu: data.niu || null,
          country: data.country || 'Cameroun',
          contactPhone: data.contactPhone || null,
        },
      },
    },
  });

  // Auto sign-in after signup
  try {
    await signIn('credentials', {
      email,
      password: data.password,
      redirectTo: '/dispatch',
    });
  } catch (err) {
    // Next.js redirect throws — re-throw so the redirect propagates
    throw err;
  }

  return { ok: true };
}

// =====================================================================
// LOGIN — wraps Auth.js signIn for use as a Server Action
// =====================================================================

const loginSchema = z.object({
  email: z.string().email("L'adresse email est invalide"),
  password: z.string().min(1, 'Mot de passe requis'),
});

export type LoginActionState = {
  errors?: Record<string, string[]>;
  formError?: string;
};

export async function loginAction(_prev: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email.toLowerCase().trim(),
      password: parsed.data.password,
      redirectTo: '/dispatch',
    });
  } catch (err) {
    // Auth.js v5 throws an "AuthError" with the type in .type; "CredentialsSignin" = bad creds
    // The Next redirect also throws — we let it propagate
    const e = err as { type?: string; digest?: string };
    if (e.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    if (e.type === 'CredentialsSignin') {
      return { formError: 'Email ou mot de passe incorrect.' };
    }
    return { formError: 'Erreur lors de la connexion. Merci de réessayer.' };
  }
  return {};
}

// =====================================================================
// LOGOUT
// =====================================================================

export async function logoutAction() {
  await signOut({ redirectTo: '/' });
}

// =====================================================================
// DISPATCH — after login, send user to the right portal
// =====================================================================

export async function dispatchAfterLogin() {
  const { auth } = await import('@/lib/auth');
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  const userType: UserType | undefined = session.user.userType;
  redirect(userType === UserType.STAFF ? '/staff' : '/investor');
}
