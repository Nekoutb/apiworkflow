import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { roleLabel } from '@/lib/roles';
import {
  queryAuditTrail,
  verifyAuditChain,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  type AuditAction,
} from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const isEn = locale === 'en';
  return { title: isEn ? 'Audit trail · Cameroon IPA' : "Journal d'audit · API Cameroun" };
}

const PAGE_SIZE = 50;

export default async function AdminAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ action?: string; entityType?: string; search?: string; page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Defense-in-depth (the admin layout already gates, but guard here too).
  const session = await auth();
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard');

  const sp = await searchParams;
  const isEn = locale === 'en';
  const localeShort = isEn ? 'en' : 'fr';
  const dtLocale = isEn ? 'en-GB' : 'fr-FR';
  const tCommon = await getTranslations('Common');

  const action = sp.action && AUDIT_ACTIONS.includes(sp.action as AuditAction) ? sp.action : undefined;
  const entityType =
    sp.entityType === 'document' || sp.entityType === 'user' || sp.entityType === 'antenne'
      ? sp.entityType
      : undefined;
  const search = (sp.search ?? '').trim() || undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1);

  const [{ rows, total }, chain] = await Promise.all([
    queryAuditTrail({ action, entityType, search, page, pageSize: PAGE_SIZE }),
    verifyAuditChain(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Helper to build a filtered URL preserving other params.
  const buildHref = (overrides: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { action, entityType, search, page: String(page), ...overrides };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== '' && !(k === 'page' && v === '1')) qs.set(k, v);
    }
    const s = qs.toString();
    return ('/admin/audit' + (s ? `?${s}` : '')) as '/admin/audit';
  };

  const title = isEn ? 'Audit trail' : "Journal d'audit";
  const intro = isEn
    ? 'Tamper-evident chain of custody. Every action on a dossier or account is recorded and hash-linked to the previous entry.'
    : "Chaîne de traçabilité infalsifiable. Chaque action sur un dossier ou un compte est enregistrée et liée par empreinte à l'entrée précédente.";

  return (
    <section className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        {isEn ? 'Administration · Audit' : 'Administration · Audit'}
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">{title}</h1>
      <p className="serif mt-2 max-w-3xl text-[14px] italic text-ink-3">{intro}</p>

      {/* Integrity banner */}
      <div
        className={
          'mt-6 flex items-center gap-3 rounded-lg border px-4 py-3 ' +
          (chain.ok ? 'border-cmgreen-800 bg-cmgreen-50' : 'border-cmred bg-cmred-50')
        }
      >
        <span className={'text-[16px] ' + (chain.ok ? 'text-cmgreen-900' : 'text-cmred')}>
          {chain.ok ? '🛡' : '⚠'}
        </span>
        <div className={'text-[12.5px] ' + (chain.ok ? 'text-cmgreen-900' : 'text-cmred')}>
          {chain.ok
            ? (isEn
                ? `Chain intact · ${chain.total} entr${chain.total === 1 ? 'y' : 'ies'} verified.`
                : `Chaîne intègre · ${chain.total} entrée(s) vérifiée(s).`)
            : (isEn ? `Integrity FAILED — ${chain.message}` : `Intégrité COMPROMISE — ${chain.message}`)}
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="mt-8 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-white p-4">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {isEn ? 'Action' : 'Action'}
          </span>
          <select name="action" defaultValue={action ?? ''} className="rounded-md border border-line-2 bg-white px-3 py-2 text-[13px]">
            <option value="">{isEn ? 'All actions' : 'Toutes les actions'}</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>{AUDIT_ACTION_LABELS[a][localeShort]}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {isEn ? 'Type' : 'Type'}
          </span>
          <select name="entityType" defaultValue={entityType ?? ''} className="rounded-md border border-line-2 bg-white px-3 py-2 text-[13px]">
            <option value="">{isEn ? 'All types' : 'Tous les types'}</option>
            <option value="document">{isEn ? 'Document' : 'Document'}</option>
            <option value="user">{isEn ? 'User' : 'Compte'}</option>
            <option value="antenne">{isEn ? 'Regional office' : 'Antenne'}</option>
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1" style={{ minWidth: 200 }}>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            {isEn ? 'Search (actor / reference)' : 'Recherche (acteur / référence)'}
          </span>
          <input
            type="search"
            name="search"
            defaultValue={search ?? ''}
            placeholder={isEn ? 'name, email, ref…' : 'nom, email, réf…'}
            className="rounded-md border border-line-2 bg-white px-3 py-2 text-[13px]"
          />
        </label>

        <button type="submit" className="rounded-md bg-blue-700 px-5 py-2 text-[12.5px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-blue-800">
          {tCommon('filter')}
        </button>
        {(action || entityType || search) && (
          <Link href="/admin/audit" className="rounded-md border border-line-2 bg-white px-4 py-2 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-3 hover:border-ink hover:text-ink">
            {tCommon('reset')}
          </Link>
        )}
      </form>

      {/* Results */}
      <div className="mt-4 text-[12px] text-ink-3">
        {isEn ? `${total} entr${total === 1 ? 'y' : 'ies'}` : `${total} entrée(s)`}
        {totalPages > 1 && ` · ${isEn ? 'page' : 'page'} ${page}/${totalPages}`}
      </div>

      <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full">
          <thead className="bg-bgsoft">
            <tr className="text-left">
              <Th>{isEn ? 'When' : 'Quand'}</Th>
              <Th>{isEn ? 'Actor' : 'Acteur'}</Th>
              <Th>{isEn ? 'Action' : 'Action'}</Th>
              <Th>{isEn ? 'Reference' : 'Référence'}</Th>
              <Th>{isEn ? 'IP' : 'IP'}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[13px] italic text-ink-3">
                  {tCommon('noResults')}
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const label = AUDIT_ACTION_LABELS[r.action as AuditAction]?.[localeShort] ?? r.action;
              const decision =
                r.after && typeof (r.after as Record<string, unknown>).decision === 'string'
                  ? ((r.after as Record<string, unknown>).decision as string)
                  : null;
              return (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="px-4 py-3 text-[11.5px] text-ink-3 tabular">
                    {r.createdAt.toLocaleString(dtLocale, { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td className="px-4 py-3 text-[12.5px]">
                    <div className="font-semibold text-ink">{r.actorName ?? r.actorEmail ?? '—'}</div>
                    {r.actorRole && (
                      <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-4">
                        {roleLabel(r.actorRole, localeShort)}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12.5px]">
                    <span className="inline-block rounded-sm bg-blue-600/10 px-2 py-0.5 text-[11px] font-semibold text-navy">
                      {label}
                    </span>
                    {decision && (
                      <span
                        className={
                          'ml-1.5 inline-block rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase ' +
                          (decision === 'APPROVED' ? 'bg-cmgreen-50 text-cmgreen-900' : 'bg-cmred-50 text-cmred')
                        }
                      >
                        {decision === 'APPROVED' ? (isEn ? 'Approved' : 'Approuvé') : (isEn ? 'Rejected' : 'Rejeté')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[11.5px]">
                    {r.entityType === 'document' && r.reference ? (
                      <Link href={`/unit/parapheur/${r.entityId}`} className="font-mono text-cmgreen-900 hover:underline">
                        {r.reference}
                      </Link>
                    ) : (
                      <span className="font-mono text-ink-3">{r.reference ?? r.entityType}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink-4">{r.ip ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={buildHref({ page: String(page - 1) })} className="rounded-md border border-line-2 bg-white px-4 py-2 text-[12px] font-semibold text-ink-2 hover:border-ink">
              ← {isEn ? 'Previous' : 'Précédent'}
            </Link>
          ) : (
            <span className="rounded-md border border-line bg-bgsoft px-4 py-2 text-[12px] text-ink-4">← {isEn ? 'Previous' : 'Précédent'}</span>
          )}
          <span className="text-[12px] text-ink-3">{page} / {totalPages}</span>
          {page < totalPages ? (
            <Link href={buildHref({ page: String(page + 1) })} className="rounded-md border border-line-2 bg-white px-4 py-2 text-[12px] font-semibold text-ink-2 hover:border-ink">
              {isEn ? 'Next' : 'Suivant'} →
            </Link>
          ) : (
            <span className="rounded-md border border-line bg-bgsoft px-4 py-2 text-[12px] text-ink-4">{isEn ? 'Next' : 'Suivant'} →</span>
          )}
        </div>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
      {children}
    </th>
  );
}
