'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { writeAudit } from '@/lib/audit';

// ============================================================================
//  Antennes — create / rename / archive
//  Only ADMIN can mutate. Antennes are needed before assigning CHEF_ANTENNE.
//  R3 decision: launch with 4 antennes (Littoral, Centre, Ouest, Adamaoua) but
//  the operator can add more later.
// ============================================================================

export type AntenneActionState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

async function assertAdmin(): Promise<{ id: string }> {
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') throw new Error('UNAUTHORIZED');
  return { id: session.user.id! };
}

const CreateSchema = z.object({
  name: z.string().min(3, 'Nom trop court.').max(80),
  region: z.string().min(2, 'Région requise.').max(60),
  ville: z.string().max(60).optional().nullable(),
  address: z.string().max(240).optional().nullable(),
});

export async function createAntenne(
  _prev: AntenneActionState,
  formData: FormData,
): Promise<AntenneActionState> {
  try {
    const admin = await assertAdmin();
    const parsed = CreateSchema.safeParse({
      name: formData.get('name'),
      region: formData.get('region'),
      ville: formData.get('ville') || null,
      address: formData.get('address') || null,
    });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.');
        if (!fieldErrors[k]) fieldErrors[k] = issue.message;
      }
      return { fieldErrors };
    }

    const exists = await db.antenne.findUnique({ where: { name: parsed.data.name } });
    if (exists) return { fieldErrors: { name: 'Cette antenne existe déjà.' } };

    await db.$transaction(async (tx) => {
      const created = await tx.antenne.create({
        data: {
          name: parsed.data.name.trim(),
          region: parsed.data.region.trim(),
          ville: parsed.data.ville?.trim() ?? null,
          address: parsed.data.address?.trim() ?? null,
          active: true,
        },
      });
      await writeAudit(tx, {
        actorUserId: admin.id,
        entityType: 'antenne',
        entityId: created.id,
        action: 'ANTENNE_CREATED',
        after: { name: created.name, region: created.region },
      });
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/data');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

export async function setAntenneActive(antenneId: string, active: boolean): Promise<AntenneActionState> {
  try {
    const admin = await assertAdmin();
    await db.$transaction(async (tx) => {
      await tx.antenne.update({ where: { id: antenneId }, data: { active } });
      await writeAudit(tx, {
        actorUserId: admin.id,
        entityType: 'antenne',
        entityId: antenneId,
        action: 'ANTENNE_STATUS_CHANGED',
        after: { active },
      });
    });
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}
