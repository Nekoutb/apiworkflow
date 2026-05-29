import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';
import { Icon } from '@/components/Icon';
import { isStaffRole, roleLabel } from '@/lib/roles';

export const metadata = { title: 'Tableau de bord · API Cameroun' };
export const dynamic = 'force-dynamic';

const SLA_RED_MS = 60 * 3_600_000; // ~12 h before 72 h deadline → "alerte"

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
  const roleFr = roleLabel(role);

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

  return (
    <main className="relative min-h-screen">
      {/* obsidian banner */}
      <div className="relative z-10 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span> Portail interne · Accès réservé au personnel{' '}
        <span className="text-gold-500">⚜</span>
      </div>

      {/* sticky glass chrome */}
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
            Cameroon Investment Promotion Agency
          </div>
        </div>
        {isAdmin && (
          <nav className="ml-6 hidden gap-1 md:flex">
            <span className="rounded-lg bg-blue-600/12 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-navy">
              Tableau de bord
            </span>
            <Link
              href="/admin/users"
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy"
            >
              Personnel
            </Link>
            <Link
              href="/admin/data"
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy"
            >
              Données
            </Link>
          </nav>
        )}
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
            {roleFr}
          </div>
          <h1>Bonjour, {session.user.name ?? 'utilisateur'}</h1>
          <p>
            Accédez à vos espaces de travail. Circuit officiel : Service du Courrier → DG →
            Organigramme → Réponse.
          </p>
        </div>

        {/* KPI strip — live counts from Postgres */}
        <div className="v4-kpis">
          <div className="v4-kpi glass">
            <div className="label">Dossiers actifs</div>
            <div className="num">{activeAssignmentsCount}</div>
            <div className="delta">en cours dans l'organigramme</div>
          </div>
          <div className="v4-kpi glass">
            <div className="label">Chez le DG</div>
            <div className="num">{dgQueueCount}</div>
            <div className="delta">à analyser & décider</div>
          </div>
          <div className="v4-kpi glass">
            <div className="label">Alertes SLA</div>
            <div className="num" style={slaAlerts > 0 ? { color: '#c8102e' } : undefined}>
              {slaAlerts}
            </div>
            <div className={`delta ${slaAlerts > 0 ? 'alert' : ''}`}>
              {slaAlerts > 0 && <Icon name="warn" className="icon-sm" />}
              {slaAlerts > 0 ? '< 12 h restant' : 'aucune alerte'}
            </div>
          </div>
          <div className="v4-kpi glass">
            <div className="label">{isUnitMember ? 'Votre parapheur' : 'Votre rôle'}</div>
            <div className="num">{isUnitMember ? myUnitCount : '—'}</div>
            <div className="delta">
              {isUnitMember ? 'affectations actives' : 'décisions en attente'}
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
                    <div className="name">Parapheur DG</div>
                    <div className="role">À analyser & dispatcher</div>
                  </div>
                  {dgQueueCount > 0 && <div className="count">{dgQueueCount}</div>}
                </div>
                <p>Suggestion d'unité par Claude · décision finale du DG.</p>
                <div className="open">
                  Ouvrir <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
            {isSecretariatMonitor && (
              <Link href="/secretariat" className="v4-tile glass">
                <div className="head">
                  <div className="chip red">
                    <Icon name="timer" />
                  </div>
                  <div className="meta">
                    <div className="name">Secrétariat DG</div>
                    <div className="role">Suivi SLA 72 h</div>
                  </div>
                  {slaAlerts > 0 && <div className="count alert">{slaAlerts}</div>}
                </div>
                <p>Monitoring des dossiers chez le DG et dispatchés. Rappels manuels.</p>
                <div className={`open ${slaAlerts > 0 ? 'alert' : ''}`}>
                  Ouvrir <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
            {isUnitMember && (
              <Link href="/unit/parapheur" className="v4-tile glass">
                <div className="head">
                  <div className="chip">
                    <Icon name="folder" />
                  </div>
                  <div className="meta">
                    <div className="name">
                      {isAdmin ? 'Parapheur universel (admin)' : 'Parapheur de mon unité'}
                    </div>
                    <div className="role">{isAdmin ? 'Toutes les affectations' : roleFr}</div>
                  </div>
                  {myUnitCount > 0 && <div className="count">{myUnitCount}</div>}
                </div>
                <p>
                  {isAdmin
                    ? 'Toutes les affectations actives — supervision du workflow post-dispatch.'
                    : 'Dossiers dispatchés vers votre unité. Délégation et co-avis.'}
                </p>
                <div className="open">
                  Ouvrir <Icon name="arrow-right" className="icon-sm" />
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
                    <div className="name">Bureau Arrivée</div>
                    <div className="role">Courrier entrant</div>
                  </div>
                </div>
                <p>Enregistrement OCR + synopsis IA · récépissé officiel.</p>
                <div className="open">
                  Ouvrir <Icon name="arrow-right" className="icon-sm" />
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
                    <div className="name">Bureau Départ</div>
                    <div className="role">Réponses officielles</div>
                  </div>
                </div>
                <p>Composition et expédition après décision du DG.</p>
                <div className="open">
                  Ouvrir <Icon name="arrow-right" className="icon-sm" />
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
                    <div className="name">Archives</div>
                    <div className="role">Clôture & recherche</div>
                  </div>
                </div>
                <p>Recherche par référence, émetteur, année.</p>
                <div className="open">
                  Ouvrir <Icon name="arrow-right" className="icon-sm" />
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
                    <div className="name">Personnel</div>
                    <div className="role">Organigramme · 37 rôles</div>
                  </div>
                </div>
                <p>Créer, éditer et désactiver les comptes. Antennes régionales.</p>
                <div className="open">
                  Ouvrir <Icon name="arrow-right" className="icon-sm" />
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
                    <div className="name">Base de données</div>
                    <div className="role">Compteurs des entités</div>
                  </div>
                </div>
                <p>Documents · Affectations · Handoffs · Antennes · Transmissions externes.</p>
                <div className="open">
                  Ouvrir <Icon name="arrow-right" className="icon-sm" />
                </div>
              </Link>
            )}
          </div>

          <aside className="v4-feed glass" aria-labelledby="dash-feed-title">
            <h2 id="dash-feed-title">Activité récente</h2>
            {notifications.length === 0 ? (
              <p className="text-[12.5px] italic text-ink-3">
                Aucune activité récente. Les notifications apparaîtront ici dès qu'un dossier vous
                concerne.
              </p>
            ) : (
              notifications.map((n) => {
                const isAlert = /(alerte|SLA|retard)/i.test(n.title);
                const isOK = /(approuv|décid|valid|clôtur)/i.test(n.title);
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
                      <div className="time">{humanTime(n.createdAt)}</div>
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

function humanTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}
