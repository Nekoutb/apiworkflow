import type { StaffRole } from '@prisma/client';

/**
 * Single source of truth for staff roles.
 * Order matters — used for selects and the workflow funnel.
 */
export const STAFF_ROLES = [
  'SECRETARY',
  'DIR_INVESTMENTS',
  'DIR_COMPLIANCE',
  'DIR_EXTERNAL',
  'DG',
  'ADMIN',
] as const satisfies readonly StaffRole[];

export const ROLE_LABELS_FR: Record<StaffRole, string> = {
  SECRETARY: 'Secrétariat',
  DIR_INVESTMENTS: 'Directeur des Investissements',
  DIR_COMPLIANCE: 'Directeur de la Conformité',
  DIR_EXTERNAL: 'Directeur des Relations Extérieures',
  DG: 'Directeur Général',
  ADMIN: 'Administrateur',
};

export const ROLE_LABELS_SHORT_FR: Record<StaffRole, string> = {
  SECRETARY: 'Secrétariat',
  DIR_INVESTMENTS: 'Dir. des Investissements',
  DIR_COMPLIANCE: 'Dir. de la Conformité',
  DIR_EXTERNAL: 'Dir. des Relations Extérieures',
  DG: 'Directeur Général',
  ADMIN: 'Administrateur',
};

export function roleLabel(role: StaffRole | null | undefined, short = false): string {
  if (!role) return '—';
  return short ? ROLE_LABELS_SHORT_FR[role] : ROLE_LABELS_FR[role];
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && (STAFF_ROLES as readonly string[]).includes(value);
}
