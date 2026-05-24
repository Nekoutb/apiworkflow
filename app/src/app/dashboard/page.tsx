import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { roleLabel } from '@/lib/roles';
import { isStaffRole } from '@/lib/roles';

export const metadata = { title: 'Tableau de bord · API Cameroun' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const roleEnum = session.user.role;
  const role = isStaffRole(roleEnum) ? roleLabel(roleEnum) : '—';
  const isAdmin = roleEnum === 'ADMIN';

  return (
    <main className="min-h-screen bg-bgsoft">
      {/* gov bar */}
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span> API Cameroun
      </div>

      {/* header */}
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
              <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink">
                Tableau de bord
              </span>
              <Link
                href="/admin/users"
                className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
              >
                Personnel
              </Link>
            </nav>
          )}
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">{session.user.name ?? session.user.email}</div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{role}</div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-14">
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
          ⚜ Connecté
        </div>
        <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
          Bienvenue, {session.user.name ?? 'Administrateur'}
        </h1>
        <p className="serif mt-2 text-[15px] italic text-ink-3">
          Authentification réussie. Le tableau de bord complet sera disponible aux étapes A19 (DG Dashboard) et A8 (corbeilles).
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {isAdmin ? (
            <Link
              href="/admin/users"
              className="group border border-cmgreen-700 bg-white p-6 transition hover:border-cmgreen-800 hover:shadow-lift"
            >
              <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-cmgreen-800">
                ✓ A2 · Disponible
              </div>
              <h3 className="serif text-[19px] font-bold text-ink">Gestion du personnel</h3>
              <p className="serif mt-2 text-[13px] italic text-ink-3">
                Créer et administrer les comptes du personnel API (Secrétariat, 3 Directeurs, DG).
              </p>
              <div className="mt-4 text-[11.5px] font-bold uppercase tracking-[0.16em] text-cmgreen-800 transition group-hover:tracking-[0.18em]">
                Ouvrir →
              </div>
            </Link>
          ) : (
            <PlaceholderCard
              eyebrow="A2 · Admin uniquement"
              title="Gestion du personnel"
              body="Création et gestion des comptes du personnel API. Accessible aux administrateurs."
            />
          )}
          <PlaceholderCard
            eyebrow="À venir · A8 – A14"
            title="Workflow d'instruction"
            body="Corbeilles par rôle, vue 3 colonnes avec assistant IA, signatures et transmissions."
          />
          <PlaceholderCard
            eyebrow="À venir · A19"
            title="Tableau de bord du DG"
            body="Indicateurs économiques consolidés, registre des conventions, alertes SLA."
            accent
          />
        </div>

        <div className="mt-12 border border-line bg-white p-6">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
            ✓ Progression
          </div>
          <h3 className="serif text-[19px] font-bold text-ink">Activités livrées</h3>
          <ul className="serif mt-3 space-y-1.5 text-[13.5px] italic text-ink-2">
            <li>• <strong className="not-italic">A0</strong> · Fondations & premier déploiement</li>
            <li>• <strong className="not-italic">A1</strong> · Auth shell (admin / admin · JWT · middleware Edge-safe)</li>
            <li>• <strong className="not-italic">A2</strong> · Gestion du personnel — 5 rôles, création/désactivation, email de bienvenue</li>
            <li className="text-ink-3">— Session active · rôle : <code className="not-italic font-mono text-ink">{role}</code></li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function PlaceholderCard({
  eyebrow, title, body, accent,
}: {
  eyebrow: string; title: string; body: string; accent?: boolean;
}) {
  return (
    <div
      className={`border p-6 ${
        accent ? 'border-obsidian bg-obsidian text-white' : 'border-line bg-white'
      }`}
    >
      <div className={`mb-2 text-[10.5px] font-semibold uppercase tracking-[0.24em] ${accent ? 'text-gold-500' : 'text-gold-700'}`}>
        {eyebrow}
      </div>
      <h3 className={`serif text-[19px] font-bold ${accent ? 'text-white' : 'text-ink'}`}>{title}</h3>
      <p className={`serif mt-2 text-[13px] italic ${accent ? 'text-white/75' : 'text-ink-3'}`}>{body}</p>
    </div>
  );
}
