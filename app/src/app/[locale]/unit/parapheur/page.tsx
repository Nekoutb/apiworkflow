import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel, roleMeta } from '@/lib/roles';
import type { StaffRole, DocumentStatus } from '@prisma/client';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';
import { Icon } from '@/components/Icon';

export const metadata = { title: "Parapheur de l'unité · API Cameroun" };
export const dynamic = 'force-dynamic';

// DG / DGA have their own /dg/parapheur — they don't belong here.
const FORBIDDEN: StaffRole[] = ['DG', 'DGA'];

const SLA_TOTAL_MS = 72 * 3_600_000;
const SLA_AMBER_MS = 40 * 3_600_000;
const SLA_RED_MS = 60 * 3_600_000;

type FilterEntry = { key: string; label: string; dbStatus?: DocumentStatus };
const STATUS_FILTERS: readonly FilterEntry[] = [
  { key: '', label: 'Tous' },
  { key: 'a-traiter', label: 'À traiter', dbStatus: 'ASSIGNED' },
  { key: 'en-traitement', label: 'En traitement', dbStatus: 'IN_TREATMENT' },
  { key: 'avis-externe', label: 'Avis externe', dbStatus: 'AWAITING_EXTERNAL_AVIS' },
  { key: 'soumis-dg', label: 'Soumis au DG', dbStatus: 'AWAITING_DG_DECISION' },
] as const;

function pillFromStatus(
  status: DocumentStatus,
  isAlert: boolean,
): { label: string; cls: string } {
  if (isAlert) return { label: 'À traiter · alerte', cls: 'alert' };
  switch (status) {
    case 'ASSIGNED':
      return { label: 'À traiter', cls: 'new' };
    case 'IN_TREATMENT':
      return { label: 'En traitement', cls: 'in-treatment' };
    case 'AWAITING_EXTERNAL_AVIS':
      return { label: 'Avis externe', cls: 'ext-avis' };
    case 'AWAITING_DG_DECISION':
      return { label: 'Soumis au DG', cls: 'dg' };
    default:
      return { label: status, cls: '' };
  }
}

function slaState(
  assignedAt: Date,
  docStatus: DocumentStatus,
): { pct: number; cls: string; label: string } {
  if (docStatus === 'AWAITING_EXTERNAL_AVIS') {
    return { pct: 100, cls: 'paused', label: 'SLA suspendu' };
  }
  const elapsed = Date.now() - assignedAt.getTime();
  const pct = Math.min(100, Math.max(2, Math.round((elapsed / SLA_TOTAL_MS) * 100)));
  const remaining = SLA_TOTAL_MS - elapsed;
  if (remaining < 0) {
    return { pct, cls: 'red', label: `SLA dépassé · ${humanDuration(-remaining)}` };
  }
  if (elapsed > SLA_RED_MS) {
    return { pct, cls: 'red', label: `${humanDuration(remaining)} restant` };
  }
  if (elapsed > SLA_AMBER_MS) {
    return { pct, cls: 'amber', label: `${humanDuration(remaining)} restant` };
  }
  return { pct, cls: '', label: `${humanDuration(remaining)} restant` };
}

function humanDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  if (h < 1) return `${totalMin} min`;
  if (h < 24) {
    const min = totalMin % 60;
    return min === 0 ? `${h} h` : `${h} h ${String(min).padStart(2, '0')}`;
  }
  const d = Math.floor(h / 24);
  return `${d} j`;
}

export default async function UnitParapheurPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status: statusFilter } = await searchParams;
  setRequestLocale(locale);

  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || FORBIDDEN.includes(role)) redirect('/dashboard');

  const isAdmin = role === 'ADMIN';
  const baseWhere = isAdmin ? {} : { assignedToRole: role };

  const filterEntry = STATUS_FILTERS.find((f) => f.key === statusFilter && f.dbStatus);

  // Data + counts in one round-trip
  const [active, counts] = await Promise.all([
    db.assignment.findMany({
      where: {
        status: 'ACTIVE',
        ...baseWhere,
        ...(filterEntry?.dbStatus ? { document: { status: filterEntry.dbStatus } } : {}),
      },
      orderBy: { assignedAt: 'asc' }, // oldest first → tightest SLA at top
      take: 100,
      select: {
        id: true,
        assignedAt: true,
        assignedToRole: true,
        document: {
          select: {
            id: true,
            reference: true,
            subject: true,
            status: true,
            submission: {
              select: { senderName: true, senderOrganization: true },
            },
          },
        },
      },
    }),
    Promise.all(
      STATUS_FILTERS.map((f) =>
        f.dbStatus
          ? db.assignment.count({
              where: { status: 'ACTIVE', ...baseWhere, document: { status: f.dbStatus } },
            })
          : db.assignment.count({ where: { status: 'ACTIVE', ...baseWhere } }),
      ),
    ),
  ]);

  const totalActive = counts[0];
  const oneDayAgo = Date.now() - 24 * 3_600_000;
  const newCount = active.filter((a) => a.assignedAt.getTime() > oneDayAgo).length;
  const alertCount = active.filter(
    (a) =>
      Date.now() - a.assignedAt.getTime() > SLA_RED_MS &&
      a.document.status !== 'AWAITING_EXTERNAL_AVIS',
  ).length;

  const myRoleMeta = roleMeta(role);
  const headerKicker = isAdmin
    ? 'Parapheur universel · vue admin'
    : myRoleMeta?.fr ?? roleLabel(role);
  const roleFr = roleLabel(role);

  return (
    <main className="relative min-h-screen">
      <div className="relative z-10 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span> Portail interne · Parapheur unité{' '}
        <span className="text-gold-500">⚜</span>
      </div>

      <header className="v4-chrome glass glass-hi">
        <AppLogo asLink={false} />
        <div className="min-w-0 leading-tight">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-3">
            République du Cameroun
          </div>
          <div
            className="truncate text-[14.5px] font-bold text-navy"
            style={{ fontFamily: "var(--font-display), 'Lexend', sans-serif" }}
          >
            Parapheur · {headerKicker}
          </div>
        </div>
        <nav className="ml-6 hidden gap-1 md:flex">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy"
          >
            Tableau de bord
          </Link>
          <span className="rounded-lg bg-blue-600/12 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-navy">
            Parapheur
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher variant="editorial" />
          <NotificationBell />
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-[13px] font-semibold text-navy">
              {session.user.name ?? session.user.email}
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleFr}</div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-6 sm:px-7 sm:py-10">
        <div className="v4-page-head">
          <div className="kicker">
            <span className="dot" />
            {headerKicker}
          </div>
          <h1>Parapheur de mon unité</h1>
          <p>
            {totalActive} dossier{totalActive === 1 ? '' : 's'} actif
            {totalActive === 1 ? '' : 's'}
            {newCount > 0 && ` · ${newCount} nouveau${newCount === 1 ? '' : 'x'} depuis hier`}
            {alertCount > 0 &&
              ` · ${alertCount} alerte${alertCount === 1 ? '' : 's'} SLA`}
            . Ordre par défaut : le plus ancien en premier (SLA le plus tendu).
          </p>
        </div>

        {/* Filter chips wired to ?status=… */}
        <div className="v4-toolbar glass">
          <div className="filters" role="tablist" aria-label="Filtre par statut">
            {STATUS_FILTERS.map((f, i) => {
              const isActive =
                (f.key === '' && !statusFilter) || (f.key !== '' && f.key === statusFilter);
              const href =
                f.key === '' ? '/unit/parapheur' : `/unit/parapheur?status=${f.key}`;
              return (
                <Link
                  key={f.key || 'all'}
                  href={href}
                  role="tab"
                  aria-selected={isActive}
                  className={`v4-filter-chip ${isActive ? 'on' : ''}`}
                >
                  {f.label}
                  <span className="num">{counts[i]}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="v4-table glass">
          {active.length > 0 && (
            <div className="v4-thead" role="row">
              <div>Référence · Objet</div>
              <div>Émetteur</div>
              <div>Reçu le</div>
              <div>Statut</div>
              <div>SLA 72 h</div>
              <div />
            </div>
          )}

          {active.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-[13px] italic text-ink-3">
                {filterEntry
                  ? `Aucun dossier avec le statut « ${filterEntry.label.toLowerCase()} » pour le moment.`
                  : isAdmin
                    ? "Aucune affectation active. Le parapheur se remplit dès qu'un document est dispatché par le DG."
                    : "Aucune affectation active. Votre parapheur se remplira dès que le DG vous dispatchera un document."}
              </p>
            </div>
          ) : (
            active.map((a) => {
              const elapsed = Date.now() - a.assignedAt.getTime();
              const isAlert =
                elapsed > SLA_RED_MS && a.document.status !== 'AWAITING_EXTERNAL_AVIS';
              const pill = pillFromStatus(a.document.status, isAlert);
              const sla = slaState(a.assignedAt, a.document.status);
              const dt = a.assignedAt;
              const adminUnit =
                isAdmin && roleMeta(a.assignedToRole)?.shortFr
                  ? roleMeta(a.assignedToRole)?.shortFr
                  : isAdmin
                    ? a.assignedToRole
                    : null;
              return (
                <Link
                  key={a.id}
                  href={`/unit/parapheur/${a.document.id}`}
                  className="v4-row"
                  role="row"
                >
                  <div className="obj">
                    <div className="ref">{a.document.reference}</div>
                    <div className="subj">{a.document.subject}</div>
                    {adminUnit && (
                      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                        → {adminUnit}
                      </div>
                    )}
                  </div>
                  <div className="sender">
                    {a.document.submission?.senderName ?? '—'}
                    {a.document.submission?.senderOrganization && (
                      <span className="ent">{a.document.submission.senderOrganization}</span>
                    )}
                  </div>
                  <div className="date">
                    {dt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    <span className="t">
                      {dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="status">
                    <span className={`status-pill ${pill.cls}`}>{pill.label}</span>
                  </div>
                  <div className={`v4-sla ${sla.cls}`}>
                    <div className="bar">
                      <div className="fill" style={{ width: `${sla.pct}%` }} />
                    </div>
                    <div className="label">{sla.label}</div>
                  </div>
                  <div className="actions">
                    <span className="open-btn" aria-label="Ouvrir le dossier">
                      <Icon name="arrow-right" />
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
