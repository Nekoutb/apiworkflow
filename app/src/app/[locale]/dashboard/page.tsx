import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
    role === 'CHEF_BUREAU_ARRIVEE' ||
    role === 'CHEF_SERVICE_COURRIER' ||
    role === 'ADMIN';
  const isCourrierDepart =
    role === 'CHEF_BUREAU_DEPART' ||
    role === 'CHEF_SERVICE_COURRIER' ||
    role === 'ADMIN';
  const isCourrierArchives =
    role === 'CHEF_BUREAU_ARCHIVES' ||
    role === 'CHEF_SERVICE_COURRIER' ||
    role === 'ADMIN';
  const isDg = role === 'DG' || role === 'DGA' || role === 'ADMIN';
  // Unit corbeille (B11): visible to anyone who can receive a DG dispatch —
  // i.e. anyone except pure DG/DGA. ADMIN sees a universal admin view.
  const isUnitMember = role !== 'DG' && role !== 'DGA';
  const roleFr = roleLabel(role);

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span> API Cameroun
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <div className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500">
            A
            <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
          </div>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">Portail interne</div>
            <div className="serif text-[17px] font-bold text-ink">Tableau de bord</div>
          </div>
          {isAdmin && (
            <nav className="ml-8 hidden gap-6 md:flex">
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">Tableau de bord</span>
              <Link href="/admin/users" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink">Personnel</Link>
              <Link href="/admin/data" className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink">Données</Link>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">{session.user.name ?? session.user.email}</div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleFr}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-14">
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
          ⚜ v2 · Re-baseline en cours
        </div>
        <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
          Bienvenue, {session.user.name ?? 'utilisateur'}
        </h1>
        <p className="serif mt-2 text-[15px] italic text-ink-3">
          Le projet a été re-baselinné autour de l'organigramme officiel (02 juillet 2020) et d'un workflow document-centrique
          (Service du Courrier → DG → Organigramme → Réponse via Courrier).
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {isDg && (
            <Link href="/dg/corbeille" className="group border-2 border-cmgreen-800 bg-white p-6 transition hover:shadow-lift">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-cmgreen-800">✓ B7-B8 · Disponible</div>
              <h3 className="serif text-[19px] font-bold text-ink">Corbeille DG — Analyse & Dispatch</h3>
              <p className="serif mt-2 text-[13px] italic text-ink-3">
                Documents transmis par le Bureau Arrivée, triés du plus ancien au plus récent.
                L&apos;IA propose une unité de l&apos;organigramme pour chaque dossier.
              </p>
              <div className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-cmgreen-800">Ouvrir →</div>
            </Link>
          )}
          {isUnitMember && (
            <Link href="/unit/corbeille" className="group border-2 border-cmgreen-800 bg-white p-6 transition hover:shadow-lift">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-cmgreen-800">✓ B11-B14 · Disponible</div>
              <h3 className="serif text-[19px] font-bold text-ink">
                {isAdmin
                  ? 'Corbeille universelle (vue admin)'
                  : 'Corbeille de mon unité'}
              </h3>
              <p className="serif mt-2 text-[13px] italic text-ink-3">
                {isAdmin
                  ? 'Toutes les affectations actives dans toutes les unités — surveillance admin du workflow post-dispatch DG et de la délégation hiérarchique interne.'
                  : `Documents dispatchés par le DG vers votre unité (${roleFr}). Prenez en charge, déléguez à une sous-unité, ou renvoyez à votre supérieur / au DG selon l'organigramme.`}
              </p>
              <div className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-cmgreen-800">Ouvrir →</div>
            </Link>
          )}
          {isCourrierArrivee && (
            <Link href="/courrier/arrivee" className="group border border-gold-700 bg-white p-6 transition hover:border-gold-800 hover:shadow-lift">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">✓ B4 · Disponible</div>
              <h3 className="serif text-[19px] font-bold text-ink">Bureau Arrivée — Enregistrement</h3>
              <p className="serif mt-2 text-[13px] italic text-ink-3">
                Enregistrement des courriers entrants avec IA (OCR + synopsis automatique),
                génération de la référence COURRIER-YYYY-NNNNNN et envoi de l&apos;accusé de réception.
              </p>
              <div className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-gold-700">Ouvrir →</div>
            </Link>
          )}
          {isCourrierDepart && (
            <Link href="/courrier/depart" className="group border border-gold-700 bg-white p-6 transition hover:border-gold-800 hover:shadow-lift">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">✓ B5 · Disponible</div>
              <h3 className="serif text-[19px] font-bold text-ink">Bureau Départ — Expédition</h3>
              <p className="serif mt-2 text-[13px] italic text-ink-3">
                Composition et expédition des réponses officielles aux émetteurs après
                décision du DG : upload du PDF signé, lettre d&apos;accompagnement, envoi par email.
              </p>
              <div className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-gold-700">Ouvrir →</div>
            </Link>
          )}
          {isCourrierArchives && (
            <Link href="/courrier/archives" className="group border border-gold-700 bg-white p-6 transition hover:border-gold-800 hover:shadow-lift">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">✓ B6 · Disponible</div>
              <h3 className="serif text-[19px] font-bold text-ink">Bureau Archives — Clôture & Recherche</h3>
              <p className="serif mt-2 text-[13px] italic text-ink-3">
                Clôture des dossiers expédiés et consultation des archives :
                recherche par référence/émetteur/objet, filtres par nature et année.
              </p>
              <div className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-gold-700">Ouvrir →</div>
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin/users" className="group border border-cmgreen-700 bg-white p-6 transition hover:border-cmgreen-800 hover:shadow-lift">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-cmgreen-800">✓ B2 · Disponible</div>
              <h3 className="serif text-[19px] font-bold text-ink">Personnel — 37 rôles · Antennes</h3>
              <p className="serif mt-2 text-[13px] italic text-ink-3">
                Créer, éditer et désactiver les comptes du personnel API. Picker hiérarchique
                groupé par sous-direction et gestion des antennes régionales.
              </p>
              <div className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-cmgreen-800">Ouvrir →</div>
            </Link>
          )}
          {isAdmin && (
            <Link href="/admin/data" className="group border border-cmgreen-700 bg-white p-6 transition hover:border-cmgreen-800 hover:shadow-lift">
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-cmgreen-800">✓ B1 · Disponible</div>
              <h3 className="serif text-[19px] font-bold text-ink">Aperçu base de données v2</h3>
              <p className="serif mt-2 text-[13px] italic text-ink-3">
                Compteurs des entités du nouveau schéma document-centrique : Documents, Submissions,
                Assignments, Handoffs, Antennes, ExternalTransmissions, etc.
              </p>
              <div className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-cmgreen-800">Ouvrir →</div>
            </Link>
          )}
        </div>

        <div className="mt-12 border border-line bg-white p-6">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
            État du projet
          </div>
          <h3 className="serif text-[19px] font-bold text-ink">v2 · Document Workflow</h3>
          <ul className="serif mt-3 space-y-1.5 text-[13.5px] italic text-ink-2">
            <li>✓ <strong className="not-italic">B0</strong> · Plan v2 adopté · 8 décisions cadrantes validées</li>
            <li>✓ <strong className="not-italic">B1</strong> · Schéma document-centrique · PostgreSQL local sur le VPS</li>
            <li>✓ <strong className="not-italic">B2</strong> · Enum 37 rôles · UI gestion personnel + antennes</li>
            <li>✓ <strong className="not-italic">B3</strong> · i18n FR + EN (next-intl)</li>
            <li>✓ <strong className="not-italic">B4</strong> · Service du Courrier — Arrivée (enregistrement + OCR IA)</li>
            <li>✓ <strong className="not-italic">B5</strong> · Service du Courrier — Départ (composition + expédition)</li>
            <li>✓ <strong className="not-italic">B6</strong> · Service du Courrier — Archives (clôture + recherche)</li>
            <li>✓ <strong className="not-italic">B7</strong> · Corbeille DG — analyse IA + suggestion d&apos;unité</li>
            <li>✓ <strong className="not-italic">B8</strong> · DG dispatcher — envoi vers l&apos;unité (Courrier transit)</li>
            <li>✓ <strong className="not-italic">B11</strong> · Corbeille universelle des unités — prise en charge & renvoi au DG</li>
            <li>✓ <strong className="not-italic">B12</strong> · Délégation interne — VERTICAL_DOWN + RETURN_UP (hiérarchie organigramme)</li>
            <li>✓ <strong className="not-italic">B13</strong> · Transferts horizontaux — co-avis entre pairs Directeurs (HORIZONTAL)</li>
            <li>✓ <strong className="not-italic">B14</strong> · Avis externe — Min. Finances, DGI, DGD, etc. (EXTERNAL_OUT/IN)</li>
            <li>⬜ <strong className="not-italic">B15</strong> · Renvoi final au DG après traitement (avec avis compilé)</li>
            <li className="text-ink-3">— Session active · rôle : <code className="not-italic font-mono text-ink">{roleFr}</code></li>
          </ul>
        </div>
      </section>
    </main>
  );
}
