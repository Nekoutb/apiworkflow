import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { Prisma } from '@prisma/client';
import type { StaffRole } from '@prisma/client';
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

/** Human-readable French + English labels for each audited action. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, { fr: string; en: string }> = {
  DOCUMENT_REGISTERED:    { fr: 'Courrier enregistré',        en: 'Document registered' },
  DG_DISPATCHED:          { fr: 'Dispatché par le DG',         en: 'Dispatched by GM' },
  DG_DECIDED:             { fr: 'Décision du DG',              en: 'GM decision' },
  RESPONSE_SENT:          { fr: 'Réponse expédiée',            en: 'Response sent' },
  DOCUMENT_CLOSED:        { fr: 'Dossier clos',                en: 'Document closed' },
  TAKEN_IN_TREATMENT:     { fr: 'Pris en charge',              en: 'Taken in treatment' },
  RETURNED_TO_DG:         { fr: 'Renvoyé au DG',               en: 'Returned to GM' },
  DELEGATED_DOWN:         { fr: 'Délégué (descendant)',        en: 'Delegated down' },
  RETURNED_UP:            { fr: 'Renvoyé au supérieur',        en: 'Returned up' },
  CO_AVIS_REQUESTED:      { fr: 'Co-avis demandé',             en: 'Peer opinion requested' },
  CO_AVIS_RETURNED:       { fr: 'Co-avis retourné',            en: 'Peer opinion returned' },
  SUBMITTED_TO_DG:        { fr: 'Soumis au DG',                en: 'Submitted to GM' },
  EXTERNAL_AVIS_REQUESTED:{ fr: 'Avis externe demandé',        en: 'External opinion requested' },
  EXTERNAL_AVIS_RECORDED: { fr: 'Avis externe enregistré',     en: 'External opinion recorded' },
  EXTERNAL_AVIS_CANCELLED:{ fr: 'Avis externe annulé',         en: 'External opinion cancelled' },
  REMINDER_SENT:          { fr: 'Rappel envoyé',               en: 'Reminder sent' },
  USER_CREATED:           { fr: 'Compte créé',                 en: 'User created' },
  USER_UPDATED:           { fr: 'Compte modifié',              en: 'User updated' },
  USER_DEACTIVATED:       { fr: 'Compte désactivé',            en: 'User deactivated' },
  USER_REACTIVATED:       { fr: 'Compte réactivé',             en: 'User reactivated' },
  USER_PASSWORD_RESET:    { fr: 'Mot de passe réinitialisé',   en: 'Password reset' },
  PASSWORD_CHANGED:       { fr: 'Mot de passe changé',         en: 'Password changed' },
  ANTENNE_CREATED:        { fr: 'Antenne créée',               en: 'Regional office created' },
  ANTENNE_STATUS_CHANGED: { fr: 'Statut antenne modifié',      en: 'Regional office status changed' },
};

export const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];

export type AuditRow = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string;
  actorName: string | null;
  actorEmail: string | null;
  actorRole: StaffRole | null;
  ip: string | null;
  /** Best-effort human reference: document.reference or the after/before payload. */
  reference: string | null;
  after: unknown;
};

export type AuditQuery = {
  action?: string;
  entityType?: string;
  /** free-text match on actor email/name or document reference */
  search?: string;
  page?: number;
  pageSize?: number;
};

/**
 * Read a page of audit entries, newest first, with optional filters. Joins the
 * actor and (when the entity is a document) resolves its reference for display.
 * Admin-only callers.
 */
export async function queryAuditTrail(
  q: AuditQuery,
): Promise<{ rows: AuditRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, q.pageSize ?? 50));

  const where: Prisma.AuditTrailEntryWhereInput = {};
  if (q.action) where.action = q.action;
  if (q.entityType) where.entityType = q.entityType;
  if (q.search && q.search.trim()) {
    const s = q.search.trim();
    where.OR = [
      { actor: { email: { contains: s, mode: 'insensitive' } } },
      { actor: { name: { contains: s, mode: 'insensitive' } } },
      // reference is inside afterJson — fall back to a string match on entityId
      { entityId: { contains: s, mode: 'insensitive' } },
    ];
  }

  const [total, entries] = await Promise.all([
    db.auditTrailEntry.count({ where }),
    db.auditTrailEntry.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        createdAt: true,
        action: true,
        entityType: true,
        entityId: true,
        ip: true,
        afterJson: true,
        beforeJson: true,
        actor: { select: { name: true, email: true, staffRole: true } },
      },
    }),
  ]);

  // Resolve document references in one batched query for the document entities.
  const docIds = entries.filter((e) => e.entityType === 'document').map((e) => e.entityId);
  const refMap = new Map<string, string>();
  if (docIds.length > 0) {
    const docs = await db.document.findMany({
      where: { id: { in: docIds } },
      select: { id: true, reference: true },
    });
    for (const d of docs) refMap.set(d.id, d.reference);
  }

  const rows: AuditRow[] = entries.map((e) => {
    const after = (e.afterJson ?? null) as Record<string, unknown> | null;
    const payloadRef =
      after && typeof after.reference === 'string' ? (after.reference as string) : null;
    return {
      id: e.id,
      createdAt: e.createdAt,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      actorName: e.actor?.name ?? null,
      actorEmail: e.actor?.email ?? null,
      actorRole: e.actor?.staffRole ?? null,
      ip: e.ip,
      reference: refMap.get(e.entityId) ?? payloadRef,
      after,
    };
  });

  return { rows, total, page, pageSize };
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
