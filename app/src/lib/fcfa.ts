/**
 * Formatting helpers for FCFA amounts.
 * Conventions are stored as BigInt to avoid 2^31 overflows.
 */

const NBSP = ' '; // narrow no-break space — thousands separator in fr-FR

export function formatFcfa(amount: bigint | number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  const n = typeof amount === 'bigint' ? amount : BigInt(amount);
  return formatInteger(n) + NBSP + 'FCFA';
}

/** Compact form: 12,5 Md FCFA / 320 M FCFA / 850 000 FCFA */
export function formatFcfaCompact(amount: bigint | number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  const n = typeof amount === 'bigint' ? amount : BigInt(amount);

  if (n >= 1_000_000_000n) {
    return formatDecimal(n, 1_000_000_000n, 1) + NBSP + 'Md' + NBSP + 'FCFA';
  }
  if (n >= 1_000_000n) {
    return formatDecimal(n, 1_000_000n, 0) + NBSP + 'M' + NBSP + 'FCFA';
  }
  return formatInteger(n) + NBSP + 'FCFA';
}

function formatInteger(n: bigint): string {
  const s = (n < 0n ? -n : n).toString();
  const groups: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    groups.unshift(s.slice(Math.max(0, i - 3), i));
  }
  return (n < 0n ? '-' : '') + groups.join(NBSP);
}

function formatDecimal(n: bigint, divisor: bigint, decimals: number): string {
  if (decimals === 0) return formatInteger(n / divisor);
  const scaled = (n * 10n ** BigInt(decimals)) / divisor;
  const s = scaled.toString().padStart(decimals + 1, '0');
  const whole = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, '');
  return frac ? `${whole},${frac}` : whole;
}
