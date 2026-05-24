'use server';

import { redirect } from 'next/navigation';
import { signIn, signOut } from '@/lib/auth';

export type LoginActionState = {
  error?: string;
};

export async function loginAction(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) {
    return { error: 'Email et mot de passe requis.' };
  }

  try {
    // Build-mode convenience: a bare username (no "@") is treated as the
    // local-part of an @api.cm address.  So "admin" → admin@api.cm,
    // "secretariat" → secretariat@api.cm, "test.user" → test.user@api.cm.
    const emailToUse = email.includes('@') ? email : `${email}@api.cm`;
    await signIn('credentials', {
      email: emailToUse,
      password,
      redirectTo: '/dashboard',
    });
  } catch (err) {
    const e = err as { type?: string; digest?: string };
    if (e.digest?.startsWith('NEXT_REDIRECT')) throw err;
    if (e.type === 'CredentialsSignin') {
      return { error: 'Identifiants incorrects.' };
    }
    return { error: 'Erreur de connexion. Réessayez.' };
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: '/' });
}
