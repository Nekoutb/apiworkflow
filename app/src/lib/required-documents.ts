/**
 * The 6 mandatory documents required for an investment-incentive
 * application under Ordonnance n° 2025/002 du 18 juillet 2025, Art. 6.
 *
 * The order matters — it drives the on-screen list i, ii, iii…
 */

import type { DocumentKind } from '@prisma/client';

export type RequiredDocSlot = {
  kind: DocumentKind;
  article: string;       // Art. 6.1 / 6.2.a / 6.2.b / 6
  title: string;         // FR title shown in the UI
  description: string;   // 1-line description
};

export const REQUIRED_DOCS: readonly RequiredDocSlot[] = [
  {
    kind: 'ACTIVITY_AUTHORIZATION',
    article: 'art. 6.1',
    title: 'Autorisation d\'exercice',
    description: 'Autorisation d\'exercer dans un secteur éligible à l\'agrément (Art. 3).',
  },
  {
    kind: 'RECRUITMENT_PLAN',
    article: 'art. 6.2.a',
    title: 'Plan de recrutement camerounais',
    description: 'Engagement de recrutement de personnel national avec calendrier indicatif.',
  },
  {
    kind: 'TECH_TRANSFER_PLAN',
    article: 'art. 6.2.a',
    title: 'Plan de transfert de technologies',
    description: 'Modalités de formation et de transfert des compétences vers le personnel local.',
  },
  {
    kind: 'LOCAL_SUBCONTRACTING',
    article: 'art. 6.2.a',
    title: 'Plan de sous-traitance locale',
    description: 'Recours prévu aux PME camerounaises (chiffrage et secteurs).',
  },
  {
    kind: 'FINANCING_PROOF',
    article: 'art. 6.2.b',
    title: 'Justification du financement',
    description: 'Attestation bancaire, lettre d\'engagement de fonds propres, etc.',
  },
  {
    kind: 'FEASIBILITY_STUDY',
    article: 'art. 6',
    title: 'Étude de faisabilité du projet',
    description: 'Dossier technique et financier complet du projet d\'investissement.',
  },
] as const;

export const REQUIRED_DOC_KINDS = REQUIRED_DOCS.map((d) => d.kind);

export function findRequiredDoc(kind: DocumentKind): RequiredDocSlot | undefined {
  return REQUIRED_DOCS.find((d) => d.kind === kind);
}

/** Roman numeral 1-6 helper for the on-screen list. */
export function romanNumeral(n: number): string {
  const map: Record<number, string> = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v', 6: 'vi' };
  return map[n] ?? String(n);
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB per spec
export const ACCEPTED_MIME = ['application/pdf'] as const;
