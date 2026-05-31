import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';
import { Icon } from '@/components/Icon';
import { isStaffRole, roleLabel } from '@/lib/roles';

export const dynamic = 'force-dynamic';

const SLA_RED_MS = 60 * 3_600_000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('dashboardTitle') };
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = session.user.role;
  if (!isStaffRole(role)) redirect('/login');

  const t = await getTranslations('Dashboard');
  const tCommon = await getTranslations('Common');
  const tTime = await getTranslations('Time');

  const isAdmin = role === 'ADMIN';
  const isCourrierArrivee =
    role === 'CHEF_BUREAU_ARRIVEE' || role === 'CHEF_SERVICE_COURRIER' || role === 'ADMIN';
  const isCourrierDepart =
    role === 'CHEF_BUREAU_DEPART' || role === 'CHEF_SERVICE_COURRIER' || role === 'ADMIN';
  const isCourrierArchives =
    role === 'CHEF_BUREAU_ARCHIVES' || role === 'CHEF_SERVICE_COURRIER' || role === 'ADMIN';
  const isDg = role === 'DG' || role === 'DGA' || role === 'ADMIN';
  const isUnitMember = role !== 'DG' && role !== 'DGA';
  const isSecretariatMonitor =
    role === 'SECRETARIAT_DG' ||
    role === 'CHEF_SERVICE_COURRIER' ||
    role === 'DG' ||
    role === 'DGA' ||
    role === 'ADMIN';
  const localizedRole = roleLabel(role, locale === 'en' ? 'en' : 'fr');

  // Live counts for KPI strip + tile badges + activity feed
  const now = Date.now();
  const slaRedCutoff = new Date(now - SLA_RED_MS);
  const userId = (session.user as { id?: string }).id;

  const [
    activeAssignmentsCount,
    dgQueueCount,
    myUnitCount,
    slaAlerts,
    notifications,
  ] = await Promise.all([
    db.assignment.count({ where: { status: 'ACTIVE' } }),
    db.document.count({
      where: { status: { in: ['AWAITING_DG_ANALYSIS', 'AWAITING_DG_DECISION'] } },
    }),
    isUnitMember
      ? db.assignment.count({
          where: isAdmin
            ? { status: 'ACTIVE' }
            : { status: 'ACTIVE', assignedToRole: role },
        })
      : Promise.resolve(0),
    db.assignment.count({
      where: {
        status: 'ACTIVE',
        assignedAt: { lt: slaRedCutoff },
        document: { status: { notIn: ['AWAITING_EXTERNAL_AVIS'] } },
      },
    }),
    userId
      ? db.notification.findMany({
          where: { forUserId: userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, body: true, createdAt: true },
        })
      : Promise.resolve([] as Array<{ id: string; title: string; body: string | null; createdAt: Date }>),
  ]);

  const displayName = session.user.name ?? (locale === 'en' ? 'user' : 'utilisateur');

  return (
    <main className="relative min-h-screen">
      {/* obsidian banner */}
      <div className="relative z-10 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span> {tCommon('internalPortal')} · {tCommon('reservedAccess')}{' '}
        <span className="text-gold-500">⚜</span>
      </div>

      {/* sticky glass chrome */}
      <header className="v4-chrome glass glass-hi">
        <AppLogo asLink={false} />
        <div className="min-w-0 leading-tight">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-3">
            {tCommon('republic')}
          </div>
          <div
            className="truncate text-[14.5px] font-bold text-navy"
            style={{ fontFamily: "var(--font-display), 'Lexend', sans-serif" }}
          >
            {tCommon('appNameLong')}
          </div>
        </div>
        {isAdmin && (
          <nav className="ml-6 hidden gap-1 md:flex">
            <span className="rounded-lg bg-blue-600/12 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-navy">
              {t('panelHeading')}
            </span>
            <Link
              href="/admin/users"
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy"
            >
              {t('tilePersonnel')}
            </Link>
            <Link
              href="/admin/data"
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy"
            >
              {t('tileData')}
            </Link>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher variant="editorial" />
          <NotificationBell />
          <Link
            href="/settings"
            aria-label={tCommon('settings')}
            title={tCommon('settings')}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white/60 text-ink-2 transition hover:border-ink hover:text-navy"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-[13px] font-semibold text-navy">
              {session.user.name ?? session.user.email}
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{localizedRole}</div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-6 sm:px-7 sm:py-10">
        <div className="v4-page-head">
          <div className="kicker">
            <span className="dot" />
            {localizedRole}
          </div>
          <h1>{t('greeting', { name: displayName })}</h1>
          <p>{t('intro')}</p>
        </div>

        {/* KPI strip — live counts from Postgres */}
        <div className="v4-kpis">
          <div className="v4-kpi glass">
            <div className="label">{t('kpiActive')}</div>
            <div className="num">{activeAssignmentsCount}</div>
            <div className="delta">{t('kpiActiveHint')}</div>
          </div>
          <div className="v4-kpi glass">
            <div className="label">{t('kpiAtDg')}</div>
            <div className="num">{dgQueueCount}</div>
            <div className="delta">{t('kpiAtDgHint')}</div>
          </div>
          <div className="v4-kpi glass">
            <div className="label">{t('kpiAlerts')}</div>
            <div className="num" style={slaAlerts > 0 ? { color: '#c8102e' } : undefined}>
              {slaAlerts}
            </div>
            <div className={`delta ${slaAlerts > 0 ? 'alert' : ''}`}>
              {slaAlerts > 0 && <Icon name="warn" className="icon-sm" />}
              {slaAlerts > 0 ? t('kpiAlertsHint') : t('kpiNoAlerts')}
            </div>
          </div>
          <div className="v4-kpi glass">
            <div className="label">{isUnitMember ? t('kpiMyParapheur') : t('kpiYourRole')}</div>
            <div className="num">{isUnitMember ? myUnitCount : '—'}</div>
            <div className="delta">
              {isUnitMember ? t('kpiMyParapheurHint') : t('kpiYourRoleHint')}
            </div>
          </div>
        </div>

        {/* Tiles + activity feed */}
        <div className="v4-col2">
          <div className="v4-tiles">
            {isDg && (
              <Link href="/dg/parapheur" className="v4-tile glass">
                <div className="head">
                  <div className="chip">
                    <Icon name="inbox" />
                  </div>
                  <div className="meta">
                    <div className="name">{t('tileDgParapheur')}</div>
                    <div className="role">{t('tileDgParapheurRole')}</div>
                  </div>
                  {dgQueueCount > 0 && <div className="count">{dgQueueCount}</div>}
                </div>
                <p>{t('tileDgParapheurDesc')}</p>
                <div className="open">
                  {tCommon('open')} <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
            <Link href="/secretariat" className="v4-tile glass">
              <div className="head">
                <div className="chip red">
                  <Icon name="timer" />
                </div>
                <div className="meta">
                  <div className="name">{t('tileSecretariat')}</div>
                  <div className="role">
                    {isSecretariatMonitor ? t('tileSecretariatRoleFull') : t('tileSecretariatRoleScoped')}
                  </div>
                </div>
                {slaAlerts > 0 && isSecretariatMonitor && (
                  <div className="count alert">{slaAlerts}</div>
                )}
              </div>
              <p>
                {isSecretariatMonitor
                  ? t('tileSecretariatDescFull')
                  : t('tileSecretariatDescScoped')}
              </p>
              <div className={`open ${isSecretariatMonitor && slaAlerts > 0 ? 'alert' : ''}`}>
                {tCommon('open')} <Icon name="arrow-right" className="icon-sm" />
              </div>
            </Link>
            {isUnitMember && (
              <Link href="/unit/parapheur" className="v4-tile glass">
                <div className="head">
                  <div className="chip">
                    <Icon name="folder" />
                  </div>
                  <div className="meta">
                    <div className="name">
                      {isAdmin ? t('tileUnitParapheurAdmin') : t('tileUnitParapheur')}
                    </div>
                    <div className="role">{isAdmin ? t('tileUnitParapheurRoleAdmin') : localizedRole}</div>
                  </div>
                  {myUnitCount > 0 && <div className="count">{myUnitCount}</div>}
                </div>
                <p>
                  {isAdmin
                    ? t('tileUnitParapheurDescAdmin')
                    : t('tileUnitParapheurDesc')}
                </p>
                <div className="open">
                  {tCommon('open')} <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
            {isCourrierArrivee && (
              <Link href="/courrier/arrivee" className="v4-tile glass">
                <div className="head">
                  <div className="chip cyan">
                    <Icon name="mail-in" />
                  </div>
                  <div className="meta">
                    <div className="name">{t('tileArrivee')}</div>
                    <div className="role">{t('tileArriveeRole')}</div>
                  </div>
                </div>
                <p>{t('tileArriveeDesc')}</p>
                <div className="open">
                  {tCommon('open')} <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
            {isCourrierDepart && (
              <Link href="/courrier/depart" className="v4-tile glass">
                <div className="head">
                  <div className="chip cyan">
                    <Icon name="send" />
                  </div>
                  <div className="meta">
                    <div className="name">{t('tileDepart')}</div>
                    <div className="role">{t('tileDepartRole')}</div>
                  </div>
                </div>
                <p>{t('tileDepartDesc')}</p>
                <div className="open">
                  {tCommon('open')} <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
            {isCourrierArchives && (
              <Link href="/courrier/archives" className="v4-tile glass">
                <div className="head">
                  <div className="chip navy">
                    <Icon name="archive" />
                  </div>
                  <div className="meta">
                    <div className="name">{t('tileArchives')}</div>
                    <div className="role">{t('tileArchivesRole')}</div>
                  </div>
                </div>
                <p>{t('tileArchivesDesc')}</p>
                <div className="open">
                  {tCommon('open')} <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/users" className="v4-tile glass">
                <div className="head">
                  <div className="chip navy">
                    <Icon name="users" />
                  </div>
                  <div className="meta">
                    <div className="name">{t('tilePersonnel')}</div>
                    <div className="role">{t('tilePersonnelRole')}</div>
                  </div>
                </div>
                <p>{t('tilePersonnelDesc')}</p>
                <div className="open">
                  {tCommon('open')} <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
            {isAdmin && (
              <Link href="/admin/data" className="v4-tile glass">
                <div className="head">
                  <div className="chip navy">
                    <Icon name="chart" />
                  </div>
                  <div className="meta">
                    <div className="name">{t('tileData')}</div>
                    <div className="role">{t('tileDataRole')}</div>
                  </div>
                </div>
                <p>{t('tileDataDesc')}</p>
                <div className="open">
                  {tCommon('open')} <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
          </div>

          <aside className="v4-feed glass" aria-labelledby="dash-feed-title">
            <h2 id="dash-feed-title">{t('feedTitle')}</h2>
            {notifications.length === 0 ? (
              <p className="text-[12.5px] italic text-ink-3">
                {t('feedEmpty')}
              </p>
            ) : (
              notifications.map((n) => {
                const isAlert = /(alerte|alert|SLA|retard|overdue)/i.test(n.title);
                const isOK = /(approuv|approv|décid|decid|valid|clôtur|clos|closed)/i.test(n.title);
                const isWarn = /(rappel|reminder|nudge)/i.test(n.title);
                const klass = isAlert ? 'alert' : isOK ? 'ok' : isWarn ? 'warn' : '';
                return (
                  <div key={n.id} className={`item ${klass}`}>
                    <div className="dot" />
                    <div className="body">
                      <div className="title">
                        <b>{n.title}</b>
                        {n.body && (
                          <>
                            {' · '}
                            {n.body.length > 100 ? `${n.body.slice(0, 100)}…` : n.body}
                          </>
                        )}
                      </div>
                      <div className="time">{humanTime(n.createdAt, tTime, locale)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function humanTime(
  d: Date,
  tTime: Awaited<ReturnType<typeof getTranslations<'Time'>>>,
  locale: string,
): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return tTime('now');
  if (min < 60) return tTime('minutesAgo', { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return tTime('hoursAgo', { n: h });
  const days = Math.floor(h / 24);
  if (days === 1) return tTime('yesterday');
  if (days < 7) return tTime('daysAgo', { n: days });
  return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: '2-digit',
    month: 'short',
  });
}
