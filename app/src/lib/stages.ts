import type { ConventionStage, ConventionStatus, Sector } from '@prisma/client';

export const STAGE_ORDER: ConventionStage[] = [
  'SECRETARY',
  'DIR_INVESTMENTS',
  'DIR_COMPLIANCE',
  'DIR_EXTERNAL',
  'DG',
];

export const STAGE_LABELS_FR: Record<ConventionStage, string> = {
  SECRETARY: 'Secrétariat',
  DIR_INVESTMENTS: 'Dir. Investissements',
  DIR_COMPLIANCE: 'Dir. Conformité',
  DIR_EXTERNAL: 'Dir. Relations Extérieures',
  DG: 'Directeur Général',
};

export function stageLabel(s: ConventionStage): string {
  return STAGE_LABELS_FR[s];
}

export function stageIndex(s: ConventionStage): number {
  return STAGE_ORDER.indexOf(s);
}

export const STATUS_LABELS_FR: Record<ConventionStatus, string> = {
  DRAFT:     'Brouillon',
  SUBMITTED: 'En instruction',
  RETURNED:  'Retourné',
  REJECTED:  'Rejeté',
  SIGNED:    'Signée',
  CLOSED:    'Clôturée',
};

export const SECTOR_LABELS_FR: Record<Sector, string> = {
  AGRICULTURE:     'Agriculture',
  INDUSTRIE:       'Industrie',
  ENERGIE:         'Énergie',
  EDUCATION_SANTE: 'Éducation & Santé',
  TRANSPORT:       'Transport',
  TOURISME:        'Tourisme',
  DISTRIBUTION:    'Distribution',
  NUMERIQUE:       'Numérique',
};

export function sectorLabel(s: Sector): string {
  return SECTOR_LABELS_FR[s];
}

export function statusLabel(s: ConventionStatus): string {
  return STATUS_LABELS_FR[s];
}

/**
 * Pill style class for a given status — maps to globals.css pill colors.
 * pending=amber, review=blue, signed=green, rejected=red, closed=grey
 */
export function statusPillClass(s: ConventionStatus): string {
  switch (s) {
    case 'DRAFT':     return 'pending';
    case 'SUBMITTED': return 'review';
    case 'SIGNED':    return 'signed';
    case 'REJECTED':  return 'rejected';
    case 'RETURNED':  return 'rejected';
    case 'CLOSED':    return 'closed';
  }
}
