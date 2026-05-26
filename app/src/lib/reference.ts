import { db } from './db';

/**
 * Generates a unique COURRIER-YYYY-NNNNNN reference number for an incoming
 * document. Sequential per calendar year, padded to 6 digits.
 *
 * Race-safe via Postgres advisory locks — two parallel calls in the same
 * second will not produce duplicates.
 */
export async function nextCourrierReference(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `COURRIER-${year}-`;

  // Take an advisory lock keyed on the year so concurrent inserts serialize
  await db.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${year})`);

  const latest = await db.document.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });

  let nextSeq = 1;
  if (latest?.reference) {
    const tail = latest.reference.slice(prefix.length);
    const parsed = Number.parseInt(tail, 10);
    if (Number.isFinite(parsed)) nextSeq = parsed + 1;
  }

  return `${prefix}${String(nextSeq).padStart(6, '0')}`;
}
