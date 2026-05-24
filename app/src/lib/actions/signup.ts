'use server';

import bcrypt from 'bcryptjs';
import { UserType } from '@prisma/client';
import { db } from '@/lib/db';
import { signIn } from '@/lib/auth';
import type { SignupState, SignupValues } from '@/lib/signup-config';

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const raisonSociale = String(formData.get('raisonSociale') ?? '').trim();
  const contactName   = String(formData.get('contactName')   ?? '').trim();
  const email         = String(formData.get('email')         ?? '').toLowerCase().trim();
  const niu           = String(formData.get('niu')           ?? '').trim();
  const legalForm     = String(formData.get('legalForm')     ?? '');
  const region        = String(formData.get('region')        ?? '');
  const city          = String(formData.get('city')          ?? '').trim();
  const contactPhone  = String(formData.get('contactPhone')  ?? '').trim();

  const values: SignupValues = {
    raisonSociale, contactName, email, niu, legalForm, region, city, contactPhone,
  };

  if (!raisonSociale) return { status: 'error', error: 'Raison sociale requise.', values };
  if (!contactName)   return { status: 'error', error: 'Nom du contact requis.', values };
  if (!email)         return { status: 'error', error: 'Adresse email requise.', values };
  if (!isValidEmail(email)) return { status: 'error', error: 'Adresse email invalide.', values };
  if (!legalForm)     return { status: 'error', error: 'Forme juridique requise.', values };
  if (!region)        return { status: 'error', error: 'Région requise.', values };
  if (!city)          return { status: 'error', error: 'Ville requise.', values };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return {
      status: 'error',
      error: 'Un compte avec cet email existe déjà. Connectez-vous plutôt.',
      values,
    };
  }

  // Build mode: password is always "admin".
  const passwordHash = await bcrypt.hash('admin', 10);

  await db.user.create({
    data: {
      email,
      passwordHash,
      name: contactName,
      userType: UserType.INVESTOR,
      emailVerified: new Date(),
      investor: {
        create: {
          raisonSociale,
          niu: niu || null,
          legalForm,
          region,
          city,
          contactName,
          contactPhone: contactPhone || null,
          isExisting: false,
        },
      },
    },
  });

  // Auto-sign-in via the credentials provider, then route via /post-login.
  // signIn throws NEXT_REDIRECT — we let it propagate.
  await signIn('credentials', {
    email,
    password: 'admin',
    redirectTo: '/post-login',
  });

  // Unreachable, but TypeScript needs a return.
  return { status: 'idle' };
}
