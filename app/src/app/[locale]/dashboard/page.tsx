import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';
import { isStaffRole, roleLabel } from '@/lib/roles';

export const metadata = { title: 'Tableau de bord · API Cameroun' };
export const dynamic = 'force-dynamic';

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
    role === 'SECRETARIAT_DG' || role === 'CHEF_SERVICE_COURRIER' ||
    role === 'DG' || role === 'DGA' || role === 'ADMIN';
  const roleFr = roleLabel(role);

  return (
    <main className="relative min-h-screen">
      {/* obsidian banner */}
      <div className="relative z-10 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span> API Cameroun
      </div>

      {/* Glass header */}
      <header className="glass glass-hi sticky top-0 z-30 mx-3 mt-3 flex items-center gap-4 rounded-2xl px-5 py-3 sm:px-7">
        <AppLogo asLink={false} />
        <div className="leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">Portail interne</div>
          <div className="text-[16px] font-bold text-navy">Tableau de bord</div>
        </div>
        {isAdmin && (
          <nav className="ml-8 hidden gap-1 md:flex">
            <span className="rounded-lg bg-blue-600/12 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-navy">Tableau de bord</span>
            <Link href="/admin/users" className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy">Personnel</Link>
            <Link href="/admin/data" className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy">Données</Link>
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3">
          <NotificationBell />
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-[13px] font-semibold text-navy">{session.user.name ?? session.user.email}</div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleFr}</div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-10 sm:px-7 sm:py-12">
        {/* Hero */}
        <div className="mb-1.5 inline-flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-blue-700">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500" />
          {roleFr}
        </div>
        <h1 className="text-[clamp(28px,3.4vw,38px)] font-bold tracking-[-0.5px] text-navy">
          Bonjour, {session.user.name ?? 'utilisateur'}
        </h1>
        <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">
          Accédez à vos espaces de travail. Circuit officiel : Service du Courrier → DG → Organigramme → Réponse.
        </p>

        {/* Tiles */}
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isDg && (
            <Tile href="/dg/parapheur" icon="📥" title="Parapheur DG"
              desc="Analyse & dispatch des courriers entrants ; suggestion d'unité par l'IA ; décisions finales." />
          )}
          {isSecretariatMonitor && (
            <Tile href="/secretariat" icon="⏱️" title="Secrétariat DG"
              accent="red"
              desc="Suivi SLA 72h des dossiers chez le DG et dispatchés aux unités. Alertes et rappels." />
          )}
          {isUnitMember && (
            <Tile href="/unit/parapheur" icon="📂"
              title={isAdmin ? 'Parapheur universel (admin)' : 'Parapheur de mon unité'}
              desc={isAdmin
                ? "Toutes les affectations actives — supervision du workflow post-dispatch et de la délégation interne."
                : `Dossiers dispatchés vers votre unité (${roleFr}). Prise en charge, délégation, co-avis, renvoi.`} />
          )}
          {isCourrierArrivee && (
            <Tile href="/courrier/arrivee" icon="📨" title="Bureau Arrivée"
              desc="Enregistrement des courriers entrants (OCR + synopsis IA), référence et accusé de réception." />
          )}
          {isCourrierDepart && (
            <Tile href="/courrier/depart" icon="📤" title="Bureau Départ"
              desc="Composition et expédition des réponses officielles après décision du DG." />
          )}
          {isCourrierArchives && (
            <Tile href="/courrier/archives" icon="🗄️" title="Bureau Archives"
              desc="Clôture des dossiers expédiés et recherche dans les archives (référence, émetteur, année)." />
          )}
          {isAdmin && (
            <Tile href="/admin/users" icon="👥" title="Personnel — 37 rôles"
              desc="Créer, éditer et désactiver les comptes. Picker hiérarchique et antennes régionales." />
          )}
          {isAdmin && (
            <Tile href="/admin/data" icon="📊" title="Base de données"
              desc="Compteurs des entités : Documents, Affectations, Handoffs, Antennes, Transmissions externes." />
          )}
        </div>
      </section>
    </main>
  );
}

function Tile({
  href, icon, title, desc, accent,
}: {
  href: string; icon: string; title: string; desc: string; accent?: 'red';
}) {
  return (
    <Link
      href={href}
      className="glass glass-hi group block rounded-2xl p-6 transition duration-200 hover:-translate-y-1 hover:shadow-glass"
    >
      <div
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-[22px] text-white shadow-[0_6px_16px_rgba(43,126,201,0.32)]"
        style={{
          background: accent === 'red'
            ? 'linear-gradient(135deg,#e06a7a,#c8102e)'
            : 'linear-gradient(135deg,#52a8ec,#2b7ec9)',
        }}
      >
        {icon}
      </div>
      <h3 className="text-[17px] font-bold text-navy">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{desc}</p>
      <div className={'mt-4 text-[11px] font-bold uppercase tracking-[0.14em] ' + (accent === 'red' ? 'text-cmred' : 'text-blue-700')}>
        Ouvrir →
      </div>
    </Link>
  );
}
