/**
 * Mapping from a StaffRole to the workflow stage they own.
 * ADMIN has no specific stage — they see all conventions.
 */

import type { StaffRole, ConventionStage } from '@prisma/client';

export const ROLE_TO_STAGE: Partial<Record<StaffRole, ConventionStage>> = {
  SECRETARY:       'SECRETARY',
  DIR_INVESTMENTS: 'DIR_INVESTMENTS',
  DIR_COMPLIANCE:  'DIR_COMPLIANCE',
  DIR_EXTERNAL:    'DIR_EXTERNAL',
  DG:              'DG',
};

export function stageForRole(role: StaffRole | null | undefined): ConventionStage | null {
  if (!role) return null;
  return ROLE_TO_STAGE[role] ?? null;
}

/** Short label used in the gov header for each staff role. */
export const ROLE_SUBTITLE_FR: Record<StaffRole, string> = {
  SECRETARY:       'Secrétariat · Filtre de complétude',
  DIR_INVESTMENTS: 'Direction des Investissements',
  DIR_COMPLIANCE:  'Direction de la Conformité',
  DIR_EXTERNAL:    'Direction des Relations Extérieures',
  DG:              'Directeur Général · Signature',
  ADMIN:           'Administration · Gestion des comptes',
};
