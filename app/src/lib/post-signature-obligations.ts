/**
 * Post-signature obligations for investors holding a signed convention
 * under Ordonnance n° 2025/002.
 *
 * This module is the single source of truth for the labels and statutory
 * references that show up in the investor portal.  The UI is built from
 * this list so it stays consistent with the law.
 */

export type ObligationStatus = 'PENDING' | 'DUE_SOON' | 'OVERDUE' | 'SUBMITTED' | 'PAID';

export type PostSignatureObligation = {
  key: string;
  article: string;        // e.g. "Art. 32"
  title: string;          // short title
  description: string;    // 1-sentence summary in French
  cadence: 'ONE_TIME' | 'ANNUAL' | 'ON_DEMAND' | 'ON_COMPLETION';
  deadlineLabel?: string; // e.g. "31 mars 2027"
  penalty?: string;       // e.g. "1 M FCFA / mois de retard"
  href: string;           // page where the investor will submit it (A7 stubs)
  available: boolean;     // whether the action is wired up yet (false → A7)
  status?: ObligationStatus;
};

export type ObligationContext = {
  signedAt: Date;          // when the convention was signed
  currentDate?: Date;      // default = now
};

/**
 * Build the obligation list for a given signed convention.
 * Status is derived from the dates; once we wire submissions in A7,
 * statuses will be reconciled against real records.
 */
export function buildObligations(
  conventionId: string,
  ctx: ObligationContext,
): PostSignatureObligation[] {
  const now = ctx.currentDate ?? new Date();
  const signedAt = ctx.signedAt;

  // Art. 33 — equipment list within 10 business days of signing
  const equipmentDeadline = addDays(signedAt, 14); // ~10 business days
  const equipmentStatus = statusFromDeadline(now, equipmentDeadline);

  // Art. 32 — annual report due by 31 March each year
  const nextMarch31 = nextMarch31From(now);
  const annualStatus = statusFromDeadline(now, nextMarch31);

  // Art. 48 — annual royalty (0.1% of investment, paid annually)
  const royaltyDeadline = nextMarch31; // same yearly cadence
  const royaltyStatus: ObligationStatus = 'PENDING';

  return [
    {
      key: 'equipment-list',
      article: 'Art. 33',
      title: 'Liste prévisionnelle d\'équipements',
      description:
        'À transmettre dans les 10 jours ouvrés suivant la signature, validée conjointement par l\'API et la Douane.',
      cadence: 'ONE_TIME',
      deadlineLabel: formatDateFr(equipmentDeadline),
      href: `/investor/conventions/${conventionId}/equipment-list`,
      available: false,
      status: equipmentStatus,
    },
    {
      key: 'annual-report',
      article: 'Art. 32',
      title: 'Rapport annuel d\'exécution',
      description:
        'Bilan annuel des engagements (emplois, investissement réalisé, exports). Hard deadline 31 mars.',
      cadence: 'ANNUAL',
      deadlineLabel: formatDateFr(nextMarch31),
      penalty: '1 M FCFA / mois de retard',
      href: `/investor/conventions/${conventionId}/annual-report`,
      available: false,
      status: annualStatus,
    },
    {
      key: 'royalty',
      article: 'Art. 48',
      title: 'Redevance annuelle',
      description:
        '0,1 % du montant agréé (plancher 100 000 FCFA, plafond 5 M FCFA) versée à l\'API.',
      cadence: 'ANNUAL',
      deadlineLabel: formatDateFr(royaltyDeadline),
      href: `/investor/conventions/${conventionId}/royalty`,
      available: false,
      status: royaltyStatus,
    },
    {
      key: 'extension',
      article: 'Art. 36',
      title: 'Demande d\'extension de délai',
      description:
        'Force majeure ou difficulté économique avérée. Extension maximale de 2 ans, non-renouvelable.',
      cadence: 'ON_DEMAND',
      href: `/investor/conventions/${conventionId}/extension`,
      available: false,
    },
    {
      key: 'attestation',
      article: 'Art. 34',
      title: 'Attestation de réalisation',
      description:
        'À l\'achèvement de la phase d\'installation. Déclenche une visite conjointe API + DGI + DGD.',
      cadence: 'ON_COMPLETION',
      href: `/investor/conventions/${conventionId}/attestation`,
      available: false,
    },
  ];
}

// ---- helpers ----

function statusFromDeadline(now: Date, deadline: Date): ObligationStatus {
  const msLeft = deadline.getTime() - now.getTime();
  const daysLeft = msLeft / (1000 * 60 * 60 * 24);
  if (daysLeft < 0) return 'OVERDUE';
  if (daysLeft < 30) return 'DUE_SOON';
  return 'PENDING';
}

function nextMarch31From(d: Date): Date {
  const year = d.getMonth() < 2 || (d.getMonth() === 2 && d.getDate() <= 31)
    ? d.getFullYear()
    : d.getFullYear() + 1;
  return new Date(Date.UTC(year, 2, 31)); // March = month index 2
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function formatDateFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export const OBLIGATION_STATUS_LABEL: Record<ObligationStatus, string> = {
  PENDING:   'À échéance',
  DUE_SOON:  'Échéance proche',
  OVERDUE:   'En retard',
  SUBMITTED: 'Transmis',
  PAID:      'Payée',
};

export function obligationStatusClass(s: ObligationStatus): string {
  switch (s) {
    case 'PENDING':   return 'closed';
    case 'DUE_SOON':  return 'pending';
    case 'OVERDUE':   return 'rejected';
    case 'SUBMITTED': return 'signed';
    case 'PAID':      return 'signed';
  }
}
