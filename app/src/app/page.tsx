import Link from 'next/link';
import { ArrowRight, Building2, Users, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border bg-cmgreen-700 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-10 rounded-lg" />
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wider opacity-80">
                République du Cameroun
              </div>
              <div className="text-sm font-semibold">
                Agence de Promotion des Investissements
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/10">
              Connexion
            </Link>
            <Link href="/signup" className="rounded-md bg-cmyellow px-3 py-1.5 text-sm font-semibold text-cmgreen-900 hover:bg-yellow-300">
              Créer un compte
            </Link>
          </nav>
        </div>
        <div className="h-1 bg-gradient-to-r from-cmgreen-700 via-cmred to-cmyellow" />
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-cmgreen-900 via-cmgreen-800 to-cmgreen-900 text-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cmyellow/40 bg-cmyellow/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cmyellow">
              ★ Portail officiel — Ordonnance n° 2025/002
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
              Investir au Cameroun,{' '}
              <span className="text-cmyellow">en toute transparence.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed opacity-90 lg:text-lg">
              Plateforme officielle de soumission, d&apos;instruction et de suivi des conventions
              d&apos;investissement entre l&apos;État du Cameroun et les investisseurs nationaux et
              étrangers. Filer un dossier en ligne, suivre son avancement à toutes les étapes,
              obtenir votre acte d&apos;agrément sans déplacement.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-lg bg-cmyellow px-5 py-3 text-sm font-semibold text-cmgreen-900 transition hover:bg-yellow-300">
                Démarrer une demande
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20">
                Suivre mon dossier
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Two doors: investor / staff */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/investor"
            className="group block rounded-2xl border border-border bg-surface p-8 shadow-soft transition hover:shadow-lift"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cmgreen-50 text-cmgreen-700">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-bold">Espace Investisseur</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Déposer votre dossier d&apos;agrément, téléverser les 6 pièces obligatoires, suivre
              les étapes de traitement et recevoir vos décisions.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-cmgreen-700 group-hover:gap-2 transition-all">
              Accéder à l&apos;espace investisseur
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>

          <Link
            href="/staff"
            className="group block rounded-2xl border border-border bg-surface p-8 shadow-soft transition hover:shadow-lift"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cmgreen-50 text-cmgreen-700">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-bold">Espace Personnel API</h2>
            <p className="mt-2 text-sm text-ink-muted">
              Workflow interne d&apos;instruction et de validation des dossiers, du Guichet
              Unique à la signature de la convention par le Directeur Général.
            </p>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-cmgreen-700 group-hover:gap-2 transition-all">
              Accéder au portail interne
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        </div>

        {/* Trust strip */}
        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          <Stat number="10" unit="j" label="jours ouvrés statutaires d'instruction (Art. 30.3)" />
          <Stat number="6" label="départements intégrés au Guichet Unique" />
          <Stat number="FR · EN" label="portail bilingue (Art. 52)" />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-6 py-6 text-xs text-ink-muted">
          <div className="flex flex-wrap items-center gap-3">
            <ShieldCheck className="h-4 w-4 text-cmgreen-700" />
            <span>Connexion chiffrée TLS 1.3 · Loi 2010/012 (Protection des Données Personnelles)</span>
            <span className="mx-2 h-1 w-1 rounded-full bg-ink-faint" />
            <span>© 2026 République du Cameroun · Présidence de la République</span>
            <span className="mx-2 h-1 w-1 rounded-full bg-ink-faint" />
            <span>Ordonnance n° 2025/002 du 18 juillet 2025</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Stat({ number, unit, label }: { number: string; unit?: string; label: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-cmgreen-700">{number}</span>
        {unit ? <span className="text-base font-medium text-cmgreen-700">{unit}</span> : null}
      </div>
      <p className="mt-2 text-sm text-ink-muted">{label}</p>
    </div>
  );
}
