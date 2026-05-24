'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { UserType, type StaffRole } from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { isStaffRole, roleLabel } from '@/lib/roles';
import { sendEmail, welcomeStaffEmail } from '@/lib/email';

import type { CreateStaffState } from '@/lib/users-config';
// Re-exported for callers that previously imported it from this file.
export type { CreateStaffState } from '@/lib/users-config';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    throw new Error('Forbidden');
  }
  return session;
}

function isValidEmail(s: string): boolean {
  // Pragmatic: not RFC-perfect, but rejects the obvious garbage.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function createStaffAction(
  _prev: CreateStaffState,
  formData: FormData,
): Promise<CreateStaffState> {
  await requireAdmin();

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').toLowerCase().trim();
  const role = String(formData.get('role') ?? '');
  const phone = String(formData.get('phone') ?? '').trim();

  const values = { name, email, role, phone };

  if (!name) return { status: 'error', error: 'Le nom complet est requis.', values };
  if (!email) return { status: 'error', error: "L'adresse email est requise.", values };
  if (!isValidEmail(email)) return { status: 'error', error: "Adresse email invalide.", values };
  if (!isStaffRole(role)) return { status: 'error', error: 'Rôle invalide.', values };

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { status: 'error', error: 'Un compte avec cet email existe déjà.', values };
  }

  const passwordHash = await bcrypt.hash('admin', 10);

  await db.user.create({
    data: {
      email,
      passwordHash,
      name,
      userType: UserType.STAFF,
      staffRole: role,
      emailVerified: new Date(),
    },
  });

  // Welcome email — graceful degrade if RESEND_API_KEY missing.
  const { subject, html } = welcomeStaffEmail({ name, email, roleLabel: roleLabel(role) });
  const sendRes = await sendEmail({ to: email, subject, html });
  const emailMode: 'sent' | 'logged' | 'error' =
    sendRes.ok ? sendRes.mode : 'error';

  revalidatePath('/admin/users');
  return { status: 'success', email, emailMode };
}

export async function toggleStaffStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  if (!id) return;

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return;

  // Refuse to deactivate the last remaining ADMIN.
  if (user.staffRole === 'ADMIN' && user.status === 'ACTIVE') {
    const activeAdmins = await db.user.count({
      where: { staffRole: 'ADMIN', status: 'ACTIVE' },
    });
    if (activeAdmins <= 1) return;
  }

  await db.user.update({
    where: { id },
    data: { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
  });

  revalidatePath('/admin/users');
}

export async function updateStaffRoleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!id || !isStaffRole(role)) return;

  const user = await db.user.findUnique({ where: { id } });
  if (!user) return;

  // Don't allow demoting the last ADMIN.
  if (user.staffRole === 'ADMIN' && role !== 'ADMIN') {
    const activeAdmins = await db.user.count({
      where: { staffRole: 'ADMIN', status: 'ACTIVE' },
    });
    if (activeAdmins <= 1) return;
  }

  await db.user.update({
    where: { id },
    data: { staffRole: role as StaffRole },
  });

  revalidatePath('/admin/users');
}
