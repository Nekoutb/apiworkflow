/**
 * Pure helpers for dossier domain logic — no React, no Server Actions.
 * Called by route handlers, Server Actions, and tests.
 */
import { Category, DocumentKind, DossierState } from '@prisma/client';
import { db } from './db';

export const MANDATORY_DOCS: Array<{ kind: DocumentKind; label: string; labelEn: string; article: string }> = [
  { kind: DocumentKind.ACTIVITY_AUTHORIZATION, label: "Autorisation d'exercice",         labelEn: 'Activity authorization',        article: 'Art. 6.1' },
  { kind: DocumentKind.RECRUITMENT_PLAN,       label: 'Plan de recrutement Camerounais', labelEn: 'Cameroonian recruitment plan',  article: 'Art. 6.2.a' },
  { kind: DocumentKind.TECH_TRANSFER_PLAN,     label: 'Plan de transfert de technologies', labelEn: 'Technology transfer plan',    article: 'Art. 6.2.a' },
  { kind: DocumentKind.LOCAL_SUBCONTRACTING,   label: 'Plan de sous-traitance locale',   labelEn: 'Local subcontracting plan',     article: 'Art. 6.2.a' },
  { kind: DocumentKind.FINANCING_PROOF,        label: 'Justification du financement',    labelEn: 'Proof of financing',            article: 'Art. 6.2.b' },
  { kind: DocumentKind.FEASIBILITY,            label: 'Étude de faisabilité du projet',  labelEn: 'Project feasibility study',     article: 'Art. 6' },
];

/**
 * Category derivation per Art. 11:
 *   A: < 1 Md FCFA
 *   B: 1–5 Md FCFA
 *   C: > 5 Md FCFA
 */
export function categoryFor(amountFcfa: bigint): Category {
  const ONE_BILLION = 1_000_000_000n;
  const FIVE_BILLION = 5_000_000_000n;
  if (amountFcfa < ONE_BILLION) return Category.A;
  if (amountFcfa <= FIVE_BILLION) return Category.B;
  return Category.C;
}

/**
 * Generate a sequential reference for a new dossier:
 *   YYYY/NNNNNN — e.g. 2026/000001
 *
 * Strategy: count existing dossiers for the year + 1, zero-padded to 6 digits.
 * Race-safe in low volume (Phase 1). For Phase 2 we'll switch to a
 * Postgres sequence per year.
 */
export async function nextDossierReference(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.dossier.count({
    where: { reference: { startsWith: `${year}/` } },
  });
  const seq = String(count + 1).padStart(6, '0');
  return `${year}/${seq}`;
}

export type DossierProgress = {
  totalDocs: number;
  uploadedDocs: number;
  acceptedDocs: number;
  rejectedDocs: number;
  pendingDocs: number;
  allUploaded: boolean;
  allAccepted: boolean;
  anyRejected: boolean;
};

export function progressForDocuments(
  documents: Array<{ kind: DocumentKind; verification: 'PENDING' | 'ACCEPTED' | 'REJECTED' }>
): DossierProgress {
  const total = MANDATORY_DOCS.length;
  const uploaded = MANDATORY_DOCS.filter((m) => documents.find((d) => d.kind === m.kind)).length;
  const accepted = documents.filter((d) => d.verification === 'ACCEPTED').length;
  const rejected = documents.filter((d) => d.verification === 'REJECTED').length;
  const pending = documents.filter((d) => d.verification === 'PENDING').length;
  return {
    totalDocs: total,
    uploadedDocs: uploaded,
    acceptedDocs: accepted,
    rejectedDocs: rejected,
    pendingDocs: pending,
    allUploaded: uploaded === total,
    allAccepted: uploaded === total && accepted === total,
    anyRejected: rejected > 0,
  };
}

export const STATE_LABEL_FR: Record<DossierState, string> = {
  DRAFT:                'Brouillon — en préparation',
  SUBMITTED:            'Soumis — pièces en vérification',
  DOCS_VERIFICATION:    'Pièces en vérification',
  RECEIPT_ISSUED:       'Reçu — en instruction',
  INSTRUCTION_DONE:     'Instruction validée — avis fiscal requis',
  TAX_OPINION_DONE:     'Avis fiscal favorable — avis douanier requis',
  CUSTOMS_OPINION_DONE: 'Avis douanier favorable — synthèse Chef GU',
  SYNTHESIS_DONE:       'Synthèse validée — signature DG',
  ACCREDITED:           'Convention signée — agréé',
  REJECTED:             'Rejeté',
  RETURNED:             'Retourné pour complément',
  SUSPENDED:            'Incitations suspendues',
  WITHDRAWN:            'Incitations retirées',
};
