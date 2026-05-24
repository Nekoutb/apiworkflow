import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { SignupForm } from './SignupForm';

export const metadata = { title: 'Créer un compte investisseur · API Cameroun' };
export const dynamic = 'force-dynamic';

export default async function SignupPage() {
  const session = await auth();
  if (session?.user) redirect('/post-login');

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        République du Cameroun{' '}
        <span className="mx-3 text-gold-500">⚜</span>
        Agence de Promotion des Investissements
      </div>

      <div className="grid min-h-[calc(100vh-26px)] lg:grid-cols-[1fr_1.1fr]">
        {/* LEFT — editorial panel */}
        <aside className="relative overflow-hidden bg-gradient-to-b from-white via-[#f3f8f5] to-[#e8f1ec] px-14 py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 60% 40% at 85% 0%, rgba(193, 151, 63, 0.10) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 0% 100%, rgba(0, 107, 58, 0.08) 0%, transparent 55%)',
            }}
          />
          <div className="relative flex h-full flex-col justify-between">
            <Link href="/" className="flex items-center gap-3.5">
              <div className="relative flex h-12 w-12 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500">
                A
                <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
                  République du Cameroun
                </div>
                <div className="serif text-[17px] font-bold text-ink">
                  Agence de Promotion des Investissements
                </div>
              </div>
            </Link>

            <div className="max-w-[440px]">
              <div className="mb-5 inline-flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-gold-700">
                Inscription investisseur
                <span className="h-px w-11 bg-gold-600" />
              </div>
              <h1 className="serif mb-5 text-[clamp(34px,3.5vw,46px)] font-semibold leading-[1.08] tracking-[-0.022em] text-ink">
                Ouvrez votre espace<br />
                <span className="italic text-cmgreen-800">d&apos;investisseur agréé.</span>
              </h1>
              <p className="text-[14.5px] leading-[1.65] text-ink-2">
                En quelques étapes, créez votre compte, téléversez les pièces requises par
                l&apos;Ordonnance n° 2025/002, et suivez l&apos;instruction de votre dossier
                jusqu&apos;à la signature de votre convention par le Directeur Général.
              </p>

              <ul className="mt-7 space-y-2.5 text-[13px] text-ink-2">
                <Tick>Délai légal d&apos;instruction&nbsp;: 10 jours ouvrés (Art. 30.3)</Tick>
                <Tick>5 étapes de validation, du Secrétariat au Directeur Général</Tick>
                <Tick>Suivi en temps réel · notifications par email</Tick>
                <Tick>Convention numérique téléchargeable une fois signée</Tick>
              </ul>
            </div>

            <div className="text-[10px] uppercase tracking-[0.14em] text-ink-3">
              © MMXXVI — Tous droits réservés
            </div>
          </div>
        </aside>

        {/* RIGHT — form card */}
        <section className="flex items-start justify-center bg-white px-8 py-14">
          <div className="w-full max-w-[480px]">
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
              ⚜ Nouveau compte
            </div>
            <h2 className="serif mb-2 text-[28px] font-semibold tracking-[-0.4px] text-ink">
              Créer mon compte investisseur
            </h2>
            <p className="serif mb-7 text-[13.5px] italic text-ink-3">
              Renseignez votre entreprise. Vous serez connecté automatiquement à la fin.
            </p>

            <SignupForm />
          </div>
        </section>
      </div>
    </main>
  );
}

function Tick({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-cmgreen-800" />
      <span>{children}</span>
    </li>
  );
}
