/**
 * Authorization helpers for the staff workflow actions.
 *
 * ADMIN can act on any stage (useful for build-phase testing).
 * Otherwise the staff role must match the convention's current stage.
 */

import type { ConventionStage, StaffRole } from '@prisma/client';
import { stageForRole } from '@/lib/staff-corbeille';

export function canActOnStage(role: StaffRole | null | undefined, stage: ConventionStage): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  return stageForRole(role) === stage;
}

export function nextStage(stage: ConventionStage): ConventionStage | null {
  const order: ConventionStage[] = ['SECRETARY', 'DIR_INVESTMENTS', 'DIR_COMPLIANCE', 'DIR_EXTERNAL', 'DG'];
  const i = order.indexOf(stage);
  if (i < 0 || i === order.length - 1) return null;
  return order[i + 1];
}
