import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/LogoutButton';

export const metadata = { title: 'Tableau de bord · API Cameroun' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const role = session.user.role ?? '—';

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
          <PlaceholderCard
            eyebrow="À venir · A2"
            title="Gestion du personnel"
            body="Création et gestion des comptes du personnel API (Secrétariat, 3 Directeurs, DG)."
          />
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
            ✓ A1 — Test gate
          </div>
          <h3 className="serif text-[19px] font-bold text-ink">Auth shell opérationnel</h3>
          <ul className="serif mt-3 space-y-1.5 text-[13.5px] italic text-ink-2">
            <li>• Connexion <code className="not-italic font-mono text-ink">admin</code> / <code className="not-italic font-mono text-ink">admin</code> validée</li>
            <li>• Session JWT établie · rôle : <code className="not-italic font-mono text-ink">{role}</code></li>
            <li>• Middleware Edge-safe (sans bcrypt) bloque les routes protégées</li>
            <li>• Déconnexion : bouton en haut à droite</li>
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
