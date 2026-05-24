/**
 * Constants + types for the Convention lifecycle actions.
 * Kept outside server-action files so 'use client' components can import.
 */

import type { Sector, Category } from '@prisma/client';
import { SECTOR_LABELS_FR } from '@/lib/stages';

export const PROJECT_SECTORS: { value: Sector; label: string }[] = (
  Object.keys(SECTOR_LABELS_FR) as Sector[]
).map((s) => ({ value: s, label: SECTOR_LABELS_FR[s] }));

export const PROJECT_TYPES = [
  { value: 'NEW',       label: 'Nouveau projet (Art. 7)' },
  { value: 'EXTENSION', label: 'Extension d\'activité (Art. 8)' },
] as const;

export type CreateConventionState =
  | { status: 'idle' }
  | { status: 'error'; error: string; values?: CreateConventionValues }
  | { status: 'success'; conventionId: string };

export type CreateConventionValues = {
  projectName?: string;
  sector?: string;
  projectType?: string;
  region?: string;
  investmentFcfa?: string;
  jobsPlanned?: string;
};

export const initialCreateConventionState: CreateConventionState = { status: 'idle' };

export type UploadDocState =
  | { status: 'idle' }
  | { status: 'success'; documentId: string }
  | { status: 'error'; error: string };

export const initialUploadDocState: UploadDocState = { status: 'idle' };

export type SubmitConventionState =
  | { status: 'idle' }
  | { status: 'error'; error: string }
  | { status: 'success' };

export const initialSubmitState: SubmitConventionState = { status: 'idle' };

/** A < 1 Md FCFA, B 1-5 Md, C > 5 Md. */
export function categoryFor(amountFcfa: bigint): Category {
  if (amountFcfa < 1_000_000_000n) return 'A';
  if (amountFcfa <= 5_000_000_000n) return 'B';
  return 'C';
}
