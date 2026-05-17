import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export const metadata = { title: 'Connexion · API Cameroun' };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      {/* Brand panel */}
      <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-cmgreen-900 via-cmgreen-800 to-cmgreen-900 px-12 py-12 text-white lg:px-16 lg:py-16">
        {/* Cameroon flag stripe on the right edge */}
        <div className="absolute inset-y-0 right-0 flex w-1.5 flex-col">
          <div className="flex-1 bg-cmgreen-700" />
          <div className="flex-1 bg-cmred" />
          <div className="flex-1 bg-cmyellow" />
        </div>

        <div className="flex items-center gap-4">
          <Logo className="h-14 w-14 rounded-xl shadow-lift" />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-widest opacity-80">République du Cameroun</div>
            <div className="text-base font-semibold">Agence de Promotion des Investissements</div>
          </div>
        </div>

        <div className="max-w-lg">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cmyellow/40 bg-cmyellow/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cmyellow">
            ★ Portail interne · Workflow d&apos;agrément
          </div>
          <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
            Promouvoir l&apos;investissement,{' '}
            <span className="text-cmyellow">en toute transparence.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed opacity-90">
            Plateforme officielle de gestion des conventions d&apos;investissement entre l&apos;État du
            Cameroun et les investisseurs nationaux et étrangers.
          </p>
          <div className="mt-5 inline-block border-l-2 border-cmyellow/60 pl-3 text-xs italic opacity-80">
            En application de l&apos;Ordonnance n° 2025/002 du 18 juillet 2025
          </div>
        </div>

        <div className="text-[11px] opacity-60">
          🔒 Connexion chiffrée TLS 1.3 · © 2026 Présidence de la République
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center bg-surface px-8 py-12">
        <div className="w-full max-w-md">
          <div className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Bienvenue
          </div>
          <h2 className="mt-1 text-3xl font-bold">Connexion au Portail</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Sélectionnez votre profil et identifiez-vous pour accéder au portail.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-bg-page p-1">
            <button className="rounded-lg bg-surface px-3 py-2 text-sm font-semibold text-cmgreen-900 shadow-soft">
              👤 Personnel API
            </button>
            <button className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink">
              🏢 Investisseur
            </button>
          </div>

          <form action="/api/auth/signin" method="post" className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Adresse email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="prenom.nom@api.cm"
                className="mt-1.5 w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-sm focus:border-cmgreen-700 focus:outline-none focus:ring-2 focus:ring-cmgreen-700/15"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Mot de passe
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1.5 w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-sm focus:border-cmgreen-700 focus:outline-none focus:ring-2 focus:ring-cmgreen-700/15"
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Se connecter →
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-ink-muted">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="font-semibold text-cmgreen-700 hover:underline">
              Créer un compte investisseur
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
