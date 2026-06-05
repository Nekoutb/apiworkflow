'use server';

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';
import { writeAudit } from '@/lib/audit';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  Server actions for /admin/users  (B2)
//  - All callable only by ADMIN (gate inside each action)
//  - Soft-deactivate, never hard-delete (preserves audit trail relations)
//  - Password defaults to "admin" per build-mode rule; resetPassword regenerates
// ============================================================================

const PASSWORD_DEFAULT = 'admin';

// Reusable shape for client → server form data
export type StaffActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

// ---------- helpers ----------------------------------------------------------

async function assertAdmin(): Promise<{ id: string }> {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== 'ADMIN') {
    throw new Error('UNAUTHORIZED');
  }
  return { id: session.user.id! };
}

function normalizeShortIdentifier(input: string): string {
  // Accepts "admin", "admin@api.cm", "Admin", " admin "  →  "admin@api.cm"
  const trimmed = String(input ?? '').trim().toLowerCase();
  if (!trimmed) return '';
  if (trimmed.endsWith('@api.cm')) return trimmed;
  // strip any accidental @ part
  const local = trimmed.split('@')[0];
  return `${local}@api.cm`;
}

const SHORT_LOCAL_RE = /^[a-z0-9](?:[a-z0-9._-]{0,38}[a-z0-9])?$/;

// ---------- createStaff ------------------------------------------------------

const CreateSchema = z.object({
  shortName: z
    .string()
    .min(2, 'Au moins 2 caractères.')
    .max(40, '40 caractères maximum.')
    .transform((s) => s.trim().toLowerCase().split('@')[0])
    .refine((s) => SHORT_LOCAL_RE.test(s), 'Lettres, chiffres, . _ - uniquement.'),
  fullName: z.string().min(2, 'Nom complet requis.').max(120),
  role: z.string().refine(isStaffRole, 'Rôle invalide.'),
  antenneId: z.string().optional().nullable(),
});

export async function createStaff(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    const admin = await assertAdmin();

    const parsed = CreateSchema.safeParse({
      shortName: formData.get('shortName'),
      fullName: formData.get('fullName'),
      role: formData.get('role'),
      antenneId: formData.get('antenneId') || null,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    const { shortName, fullName, role, antenneId } = parsed.data;
    const email = `${shortName}@api.cm`;

    const exists = await db.user.findUnique({ where: { email } });
    if (exists) {
      return { fieldErrors: { shortName: 'Cet identifiant existe déjà.' } };
    }

    // Antenne is only meaningful for CHEF_ANTENNE in v2 — silently null it otherwise
    const effectiveAntenne =
      role === 'CHEF_ANTENNE' && antenneId ? antenneId : null;

    const passwordHash = await bcrypt.hash(PASSWORD_DEFAULT, 10);

    await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          name: fullName,
          passwordHash,
          userType: 'STAFF',
          staffRole: role as StaffRole,
          antenneId: effectiveAntenne,
          emailVerified: new Date(),
          status: 'ACTIVE',
        },
      });
      await writeAudit(tx, {
        actorUserId: admin.id,
        entityType: 'user',
        entityId: created.id,
        action: 'USER_CREATED',
        after: { email, name: fullName, role, antenneId: effectiveAntenne },
      });
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ---------- updateStaff ------------------------------------------------------

const UpdateSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().min(2).max(120),
  role: z.string().refine(isStaffRole, 'Rôle invalide.'),
  antenneId: z.string().optional().nullable(),
});

export async function updateStaff(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  try {
    const admin = await assertAdmin();

    const parsed = UpdateSchema.safeParse({
      userId: formData.get('userId'),
      fullName: formData.get('fullName'),
      role: formData.get('role'),
      antenneId: formData.get('antenneId') || null,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Données invalides' };
    }

    const { userId, fullName, role, antenneId } = parsed.data;
    const effectiveAntenne =
      role === 'CHEF_ANTENNE' && antenneId ? antenneId : null;

    await db.$transaction(async (tx) => {
      const before = await tx.user.findUnique({
        where: { id: userId },
        select: { name: true, staffRole: true, antenneId: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          name: fullName,
          staffRole: role as StaffRole,
          antenneId: effectiveAntenne,
        },
      });
      await writeAudit(tx, {
        actorUserId: admin.id,
        entityType: 'user',
        entityId: userId,
        action: 'USER_UPDATED',
        before: before ?? null,
        after: { name: fullName, role, antenneId: effectiveAntenne },
      });
    });

    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ---------- deactivate / reactivate -----------------------------------------

export async function deactivateStaff(userId: string): Promise<StaffActionState> {
  try {
    const me = await assertAdmin();
    if (me.id === userId) {
      return { error: 'Vous ne pouvez pas désactiver votre propre compte.' };
    }
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
      await writeAudit(tx, {
        actorUserId: me.id,
        entityType: 'user',
        entityId: userId,
        action: 'USER_DEACTIVATED',
        after: { status: 'SUSPENDED' },
      });
    });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

export async function reactivateStaff(userId: string): Promise<StaffActionState> {
  try {
    const me = await assertAdmin();
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { status: 'ACTIVE' } });
      await writeAudit(tx, {
        actorUserId: me.id,
        entityType: 'user',
        entityId: userId,
        action: 'USER_REACTIVATED',
        after: { status: 'ACTIVE' },
      });
    });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

// ---------- resetPassword ---------------------------------------------------

export async function resetPassword(userId: string): Promise<StaffActionState> {
  try {
    const me = await assertAdmin();
    const passwordHash = await bcrypt.hash(PASSWORD_DEFAULT, 10);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await writeAudit(tx, {
        actorUserId: me.id,
        entityType: 'user',
        entityId: userId,
        // never record the password itself — only that a reset occurred
        action: 'USER_PASSWORD_RESET',
        after: { resetToDefault: true },
      });
    });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
