'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// =============================================================================
//  B22 — Staff settings actions
//
//  updateMyLocale  : persist the FR/EN preference to User.locale AND set the
//                    NEXT_LOCALE cookie next-intl reads. Together with the
//                    post-login cookie sync, the choice follows the user
//                    across sessions and devices (closes B21 P5).
//  changeMyPassword: verify current password (bcrypt), validate the new one,
//                    persist the new hash. No schema change (passwordHash
//                    already exists). Self-service only — never touches other
//                    accounts.
// =============================================================================

const LOCALES = ['fr', 'en'] as const;
type Locale = (typeof LOCALES)[number];

export type UpdateLocaleResult = { ok?: boolean; error?: string };

export async function updateMyLocale(locale: string): Promise<UpdateLocaleResult> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: 'unauthorized' };
  if (!LOCALES.includes(locale as Locale)) return { error: 'invalidData' };

  await db.user.update({ where: { id: userId }, data: { locale } });

  // Mirror into the cookie next-intl uses so the change is immediate and
  // survives until the next login (where post-login re-syncs from the DB).
  const jar = await cookies();
  jar.set('NEXT_LOCALE', locale, {
    path: '/',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

export type ChangePasswordState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<'oldPassword' | 'newPassword' | 'confirmPassword', string>>;
};

export async function changeMyPassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: 'unauthorized' };

  const oldPassword = String(formData.get('oldPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  const fieldErrors: NonNullable<ChangePasswordState['fieldErrors']> = {};
  if (!oldPassword) fieldErrors.oldPassword = 'required';
  if (newPassword.length < 8) fieldErrors.newPassword = 'passwordTooShort';
  if (newPassword !== confirmPassword) fieldErrors.confirmPassword = 'passwordMismatch';
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user?.passwordHash) return { error: 'unknown' };

  const ok = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!ok) return { fieldErrors: { oldPassword: 'passwordWrong' } };

  const newHash = await bcrypt.hash(newPassword, 10);
  await db.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

  return { ok: true };
}
