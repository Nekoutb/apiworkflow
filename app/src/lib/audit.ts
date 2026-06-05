import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import { db } from './db';

/**
 * S1 — Tamper-evident audit trail (chain-of-custody).
 *
 * Every mutating server action records one AuditTrailEntry INSIDE its existing
 * Prisma $transaction, so the audit row commits atomically with the change it
 * describes (both roll back together on failure).
 *
 * Integrity model:
 *   - Each entry stores `hash = sha256(prevHash + canonicalJSON(payload))`.
 *   - `prevHash` is the hash of the immediately-preceding entry (a single global
 *     chain). Editing or deleting any historical row changes its hash and breaks
 *     every subsequent link — detectable by verifyAuditChain().
 *   - A Postgres transaction-scoped advisory lock serializes chain writes so two
 *     concurrent transactions cannot read the same `prevHash` and fork the chain.
 *     (Same race-safe primitive already used by reference.ts.) The lock auto-
 *     releases on commit/rollback; callers should writeAudit() LAST in their
 *     transaction to minimise the time it is held.
 *
 * No schema change is required — the AuditTrailEntry model already exists.
 */

// Distinct from the year-based reference lock key in reference.ts.
const AUDIT_LOCK_KEY = 728041;

type Tx = Prisma.TransactionClient;

export type AuditAction =
  // --- document workflow
  | 'DOCUMENT_REGISTERED'
  | 'DG_DISPATCHED'
  | 'DG_DECIDED'
  | 'RESPONSE_SENT'
  | 'DOCUMENT_CLOSED'
  | 'TAKEN_IN_TREATMENT'
  | 'RETURNED_TO_DG'
  | 'DELEGATED_DOWN'
  | 'RETURNED_UP'
  | 'CO_AVIS_REQUESTED'
  | 'CO_AVIS_RETURNED'
  | 'SUBMITTED_TO_DG'
  | 'EXTERNAL_AVIS_REQUESTED'
  | 'EXTERNAL_AVIS_RECORDED'
  | 'EXTERNAL_AVIS_CANCELLED'
  | 'REMINDER_SENT'
  // --- administration
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED'
  | 'USER_PASSWORD_RESET'
  | 'PASSWORD_CHANGED'
  | 'ANTENNE_CREATED'
  | 'ANTENNE_STATUS_CHANGED';

export type AuditParams = {
  actorUserId: string | null;
  entityType: 'document' | 'user' | 'antenne';
  entityId: string;
  action: AuditAction;
  /** State before the change (optional — omit for pure creates). */
  before?: Record<string, unknown> | null;
  /** State after / details of the change (optional). */
  after?: Record<string, unknown> | null;
};

/**
 * Deterministic JSON: keys sorted recursively, Dates → ISO. Required so the
 * stored hash is reproducible byte-for-byte at verification time.
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  const t = typeof value;
  if (t === 'number' || t === 'boolean') return JSON.stringify(value);
  if (t === 'bigint') return JSON.stringify((value as bigint).toString());
  if (t === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v): string => stableStringify(v)).join(',') + ']';
  }
  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k): string => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
  }
  return 'null';
}

/** sha256(prevHash + canonicalJSON(payload)) → hex. Explicit return type so
 *  callers never inherit `any` from Prisma's JsonValue inside the payload. */
function chainHash(prevHash: string | null, payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update((prevHash ?? '') + stableStringify(payload))
    .digest('hex');
}

async function requestContext(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers();
    const fwd = h.get('x-forwarded-for');
    const ip = (fwd ? fwd.split(',')[0]?.trim() : null) ?? h.get('x-real-ip') ?? null;
    const userAgent = h.get('user-agent') ?? null;
    return { ip, userAgent };
  } catch {
    // Not in a request scope (e.g. a background job) — context simply absent.
    return { ip: null, userAgent: null };
  }
}

/**
 * Append one hash-chained entry to the audit trail. MUST be called inside a
 * Prisma interactive transaction (`db.$transaction(async (tx) => { … })`) so it
 * is atomic with the mutation it records.
 */
export async function writeAudit(tx: Tx, params: AuditParams): Promise<void> {
  // Serialize chain access for the remainder of this transaction.
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY})`);

  // Read the current chain head. Deterministic ordering (createdAt, then cuid id)
  // — under the advisory lock the previous writer has already committed, so this
  // returns the genuine latest entry.
  const last = await tx.auditTrailEntry.findFirst({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { hash: true },
  });
  const prevHash = last?.hash ?? null;

  const { ip, userAgent } = await requestContext();

  const before = params.before ?? null;
  const after = params.after ?? null;

  // Canonical payload that the hash covers. Order of keys here is irrelevant —
  // stableStringify sorts them — but it must contain every persisted field so
  // the hash is bound to the full row.
  const payload: Record<string, unknown> = {
    actorUserId: params.actorUserId,
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    before,
    after,
    ip,
    userAgent,
    prevHash,
  };
  const hash = chainHash(prevHash, payload);

  await tx.auditTrailEntry.create({
    data: {
      actorUserId: params.actorUserId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      beforeJson: before === null ? Prisma.JsonNull : (before as Prisma.InputJsonValue),
      afterJson: after === null ? Prisma.JsonNull : (after as Prisma.InputJsonValue),
      ip,
      userAgent,
      prevHash,
      hash,
    },
  });
}

export type AuditVerification = {
  ok: boolean;
  total: number;
  /** index (0-based, chronological) of the first broken link, or null if ok. */
  brokenAt: number | null;
  brokenEntryId: string | null;
  message: string;
};

/**
 * Recompute the whole chain and confirm every link matches. Detects any
 * tampering, deletion, or re-ordering of historical entries. Admin-only callers.
 */
export async function verifyAuditChain(): Promise<AuditVerification> {
  const entries = await db.auditTrailEntry.findMany({
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      actorUserId: true,
      entityType: true,
      entityId: true,
      action: true,
      beforeJson: true,
      afterJson: true,
      ip: true,
      userAgent: true,
      prevHash: true,
      hash: true,
    },
  });

  let prevHash: string | null = null;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if ((e.prevHash ?? null) !== prevHash) {
      return {
        ok: false,
        total: entries.length,
        brokenAt: i,
        brokenEntryId: e.id,
        message: `Lien rompu à l'entrée ${i} : prevHash ne correspond pas à la chaîne.`,
      };
    }
    const payload: Record<string, unknown> = {
      actorUserId: e.actorUserId,
      entityType: e.entityType,
      entityId: e.entityId,
      action: e.action,
      before: e.beforeJson ?? null,
      after: e.afterJson ?? null,
      ip: e.ip,
      userAgent: e.userAgent,
      prevHash,
    };
    const expected = chainHash(prevHash, payload);
    if (expected !== e.hash) {
      return {
        ok: false,
        total: entries.length,
        brokenAt: i,
        brokenEntryId: e.id,
        message: `Empreinte invalide à l'entrée ${i} : contenu modifié après écriture.`,
      };
    }
    prevHash = e.hash;
  }

  return {
    ok: true,
    total: entries.length,
    brokenAt: null,
    brokenEntryId: null,
    message: `Chaîne intègre · ${entries.length} entrée(s) vérifiée(s).`,
  };
}
