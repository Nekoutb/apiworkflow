import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import type { Prisma, StaffRole, DocumentNature } from '@prisma/client';
import { CloseButton } from './CloseButton';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';

export const metadata = { title: 'Archives · Bureau Archives · API Cameroun' };
export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = [
  'ADMIN',
  'CHEF_BUREAU_ARCHIVES',
  'CHEF_SERVICE_COURRIER',
];

const NATURE_OPTIONS: { value: '' | DocumentNature; label: string }[] = [
  { value: '',                       label: 'Toutes natures' },
  { value: 'AGREMENT_REQUEST',       label: "Demande d'agrément" },
  { value: 'GENERAL_CORRESPONDENCE', label: 'Correspondance' },
  { value: 'OFFICIAL_NOTIFICATION',  label: 'Notification' },
  { value: 'PARTNERSHIP_PROPOSAL',   label: 'Partenariat' },
  { value: 'COMPLAINT',              label: 'Réclamation' },
  { value: 'REPORT',                 label: 'Rapport' },
  { value: 'OTHER',                  label: 'Autre' },
];

const NATURE_SHORT: Record<string, string> = {
  AGREMENT_REQUEST:       "Demande d'agrément",
  GENERAL_CORRESPONDENCE: 'Correspondance',
  OFFICIAL_NOTIFICATION:  'Notification',
  PARTNERSHIP_PROPOSAL:   'Partenariat',
  COMPLAINT:              'Réclamation',
  REPORT:                 'Rapport',
  OTHER:                  'Autre',
};

export default async function ArchivesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || !ALLOWED.includes(role)) redirect('/dashboard');

  // ---- Read filter inputs ----
  const q = (typeof sp.q === 'string' ? sp.q : '').trim();
  const natureFilter =
    typeof sp.nature === 'string' && (NATURE_OPTIONS.some((n) => n.value === sp.nature) && sp.nature !== '')
      ? (sp.nature as DocumentNature)
      : null;
  const yearFilter = typeof sp.year === 'string' && /^\d{4}$/.test(sp.year)
    ? Number.parseInt(sp.year, 10)
    : null;

  // ---- Build where clause ----
  const closedWhere: Prisma.DocumentWhereInput = {
    status: 'CLOSED',
  };
  if (q) {
    closedWhere.OR = [
      { reference: { contains: q, mode: 'insensitive' } },
      { subject:   { contains: q, mode: 'insensitive' } },
      { submission: { is: { senderName:         { contains: q, mode: 'insensitive' } } } },
      { submission: { is: { senderEmail:        { contains: q, mode: 'insensitive' } } } },
      { submission: { is: { senderOrganization: { contains: q, mode: 'insensitive' } } } },
    ];
  }
  if (natureFilter) closedWhere.nature = natureFilter;
  if (yearFilter) {
    const start = new Date(Date.UTC(yearFilter, 0, 1));
    const end   = new Date(Date.UTC(yearFilter + 1, 0, 1));
    closedWhere.closedAt = { gte: start, lt: end };
  }

  // ---- Queries ----
  const [
    archived,
    awaitingClosure,
    totalArchived,
    thisYearCount,
    thisMonthCount,
    natureBreakdown,
    distinctYearsRaw,
  ] = await Promise.all([
    db.document.findMany({
      where: closedWhere,
      orderBy: [{ closedAt: 'desc' }, { responseSentAt: 'desc' }],
      take: 100,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        closedAt: true,
        responseSentAt: true,
        submission: { select: { senderName: true, senderEmail: true, senderOrganization: true } },
      },
    }),
    db.document.findMany({
      where: { status: 'RESPONSE_SENT' },
      orderBy: { responseSentAt: 'asc' },
      take: 50,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        responseSentAt: true,
        submission: { select: { senderName: true, senderEmail: true } },
      },
    }),
    db.document.count({ where: { status: 'CLOSED' } }),
    db.document.count({
      where: { status: 'CLOSED', closedAt: { gte: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) } },
    }),
    db.document.count({
      where: { status: 'CLOSED', closedAt: { gte: startOfMonthUTC() } },
    }),
    db.document.groupBy({
      by: ['nature'],
      where: { status: 'CLOSED' },
      _count: true,
    }),
    db.$queryRaw<{ y: number }[]>`
      SELECT DISTINCT EXTRACT(YEAR FROM "closedAt")::int AS y
      FROM "Document"
      WHERE "status" = 'CLOSED' AND "closedAt" IS NOT NULL
      ORDER BY y DESC
    `,
  ]);

  // Group results by year for the timeline display
  type ArchivedRow = (typeof archived)[number];
  const byYear: { year: number; rows: ArchivedRow[] }[] = [];
  for (const row of archived) {
    const y = row.closedAt?.getUTCFullYear() ?? row.responseSentAt?.getUTCFullYear() ?? 0;
    let group = byYear.find((g) => g.year === y);
    if (!group) {
      group = { year: y, rows: [] };
      byYear.push(group);
    }
    group.rows.push(row);
  }

  const hasActiveFilter = Boolean(q || natureFilter || yearFilter);
  const distinctYears = distinctYearsRaw.map((r) => r.y).filter((y) => y > 0);

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span>
        Service du Courrier <span className="mx-3 text-gold-500">⚜</span>
        Bureau Archives
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Portail interne · Service du Courrier
            </div>
            <div className="serif text-[17px] font-bold text-ink">Bureau Archives — Clôture & Recherche</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">{session.user.name ?? session.user.email}</div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleLabel(role)}</div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-10">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total archivés"        value={totalArchived} />
          <Stat label="Cette année"           value={thisYearCount} />
          <Stat label="Ce mois-ci"            value={thisMonthCount} />
          <Stat label="En attente de clôture" value={awaitingClosure.length} accent />
        </div>

        {/* Nature breakdown */}
        {natureBreakdown.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2 text-[10.5px]">
            <span className="font-bold uppercase tracking-[0.18em] text-ink-3">Répartition&nbsp;:</span>
            {natureBreakdown.map((n) => (
              <span key={n.nature} className="border border-line bg-white px-2 py-0.5">
                <span className="font-bold text-ink">{NATURE_SHORT[n.nature] ?? n.nature}</span>{' '}
                <span className="text-ink-3">· {n._count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Awaiting closure */}
        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          En attente de clôture
        </h2>
        <p className="serif mb-4 text-[12.5px] italic text-ink-3">
          Documents au statut <strong>RESPONSE_SENT</strong>. La clôture les déplace
          définitivement dans les archives (statut <strong>CLOSED</strong>).
        </p>
        {awaitingClosure.length === 0 ? (
          <div className="border border-line bg-white px-5 py-8 text-center text-[12.5px] italic text-ink-3">
            Aucun document en attente de clôture.
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full">
              <thead className="bg-bgsoft">
                <tr className="text-left">
                  <Th>Référence</Th>
                  <Th>Émetteur</Th>
                  <Th>Objet</Th>
                  <Th>Réponse envoyée</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {awaitingClosure.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">{d.reference}</td>
                    <td className="px-4 py-3 text-[12.5px]">
                      <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                      <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-2">
                      <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {d.responseSentAt?.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <CloseButton documentId={d.id} reference={d.reference} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Search */}
        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Archives
        </h2>
        <form method="GET" className="mb-6 border border-line bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
            <input
              name="q"
              defaultValue={q}
              placeholder="Recherche : référence, nom, organisation, objet…"
              className="border border-line-2 bg-white px-3.5 py-2.5 text-[13px] focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
            />
            <select
              name="nature"
              defaultValue={natureFilter ?? ''}
              className="border border-line-2 bg-white px-3.5 py-2.5 text-[13px] focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
            >
              {NATURE_OPTIONS.map((n) => (
                <option key={n.value || 'all'} value={n.value}>{n.label}</option>
              ))}
            </select>
            <select
              name="year"
              defaultValue={yearFilter ?? ''}
              className="border border-line-2 bg-white px-3.5 py-2.5 text-[13px] focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
            >
              <option value="">Toutes années</option>
              {distinctYears.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-obsidian px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-500 hover:bg-ink"
              >
                Rechercher
              </button>
              {hasActiveFilter && (
                <Link
                  href="/courrier/archives"
                  className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-3 hover:border-ink hover:text-ink"
                >
                  Effacer
                </Link>
              )}
            </div>
          </div>
          {hasActiveFilter && (
            <p className="serif mt-2 text-[11.5px] italic text-ink-3">
              {archived.length === 100 ? 'Plus de 100' : archived.length} résultat
              {archived.length > 1 ? 's' : ''}
              {q && ` pour « ${q} »`}
              {natureFilter && ` · nature ${NATURE_SHORT[natureFilter] ?? natureFilter}`}
              {yearFilter && ` · année ${yearFilter}`}
            </p>
          )}
        </form>

        {archived.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            {hasActiveFilter
              ? 'Aucun résultat. Essayez avec moins de filtres.'
              : 'Aucun document archivé pour le moment. La file se remplit dès qu\'un document est clos depuis la section ci-dessus.'}
          </div>
        ) : (
          <div className="space-y-6">
            {byYear.map((g) => (
              <div key={g.year} className="border border-line bg-white">
                <div className="flex items-baseline justify-between border-b border-line bg-bgsoft px-4 py-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-2">
                    {g.year}
                  </h3>
                  <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
                    {g.rows.length} document{g.rows.length > 1 ? 's' : ''}
                  </span>
                </div>
                <table className="w-full">
                  <thead className="bg-bgsoft/40">
                    <tr className="text-left">
                      <Th>Référence</Th>
                      <Th>Émetteur</Th>
                      <Th>Objet</Th>
                      <Th>Nature</Th>
                      <Th>Clos le</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((d) => (
                      <tr key={d.id} className="border-t border-line align-top">
                        <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">{d.reference}</td>
                        <td className="px-4 py-3 text-[12.5px]">
                          <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                          <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                          {d.submission?.senderOrganization && (
                            <div className="text-[10.5px] italic text-ink-4">{d.submission.senderOrganization}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[12.5px] text-ink-2">
                          <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                        </td>
                        <td className="px-4 py-3 text-[11.5px] text-ink-3">
                          {NATURE_SHORT[d.nature] ?? d.nature}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-ink-3">
                          {d.closedAt?.toLocaleDateString('fr-FR') ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            ← Tableau de bord
          </Link>
        </div>
      </section>
    </main>
  );
}

function startOfMonthUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={'border bg-white px-4 py-3.5 ' + (accent ? 'border-gold-700' : 'border-line')}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div className={'mt-1 text-[24px] font-semibold ' + (accent ? 'text-gold-700' : 'text-ink')}>
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
      {children}
    </th>
  );
}
