/**
 * Constants + types for the post-signature obligation forms.
 * Kept outside the 'use server' action files so client components can import.
 */

export type SubmissionStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAID';

export type ActionState<T = unknown> =
  | { status: 'idle' }
  | { status: 'error'; error: string; values?: T }
  | { status: 'success'; message?: string };

export const initialState: ActionState = { status: 'idle' };

// ----- royalty calculation per Art. 48 -----
// 0,1 % of agreed investment, floor 100 000 FCFA, ceiling 5 000 000 FCFA.
export const ROYALTY_FLOOR_FCFA   = 100_000n;
export const ROYALTY_CEILING_FCFA = 5_000_000n;
export const ROYALTY_RATE_BPS     = 10n; // 10 basis points = 0.1 %

export function computeRoyalty(investmentFcfa: bigint): bigint {
  const raw = (investmentFcfa * ROYALTY_RATE_BPS) / 10_000n;
  if (raw < ROYALTY_FLOOR_FCFA)   return ROYALTY_FLOOR_FCFA;
  if (raw > ROYALTY_CEILING_FCFA) return ROYALTY_CEILING_FCFA;
  return raw;
}

// ----- year picker bounds -----
export function fiscalYearOptions(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y - 2, y - 1, y]; // last two years + current
}

// ----- extension months cap (Art. 36.3) -----
export const EXTENSION_MONTHS_MAX = 24;

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  PENDING:  'En cours d\'examen',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Rejetée',
  PAID:     'Payée',
};

export function submissionStatusClass(s: SubmissionStatus): string {
  switch (s) {
    case 'PENDING':  return 'review';
    case 'ACCEPTED': return 'signed';
    case 'PAID':     return 'signed';
    case 'REJECTED': return 'rejected';
  }
}
