import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { SignupForm } from './SignupForm';

export const metadata = { title: 'Créer un compte · API Cameroun' };

export default function SignupPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-cmgreen-900 via-cmgreen-800 to-cmgreen-900 px-12 py-12 text-white lg:px-16 lg:py-16">
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
            ★ Création d&apos;un compte investisseur
          </div>
          <h1 className="text-3xl font-bold leading-tight lg:text-4xl">
            Démarrez votre demande{' '}
            <span className="text-cmyellow">en quelques minutes.</span>
          </h1>
          <p className="mt-5 max-w-md text-sm leading-relaxed opacity-90">
            Un compte vous permet de déposer en ligne votre dossier d&apos;agrément,
            de suivre les 6 étapes d&apos;instruction du Guichet Unique et de recevoir
            votre acte d&apos;agrément sans déplacement.
          </p>
          <ul className="mt-6 space-y-2 text-sm opacity-90">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-cmyellow">✓</span>
              <span>Téléversement sécurisé des 6 pièces obligatoires (Art. 6)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-cmyellow">✓</span>
              <span>Suivi en temps réel du parcours de votre dossier</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-cmyellow">✓</span>
              <span>Délai légal d&apos;instruction : 10 jours ouvrés (Art. 30.3)</span>
            </li>
          </ul>
        </div>

        <div className="text-[11px] opacity-60">
          🔒 Connexion chiffrée TLS 1.3 · Loi 2010/012 (Protection des Données Personnelles)
        </div>
      </aside>

      <section className="flex items-center justify-center bg-surface px-8 py-12">
        <div className="w-full max-w-lg">
          <div className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Compte investisseur
          </div>
          <h2 className="mt-1 text-3xl font-bold">Créer un compte</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Renseignez vos informations. Le personnel API obtient un compte par l&apos;administrateur.
          </p>

          <SignupForm />

          <p className="mt-6 text-center text-sm text-ink-muted">
            Vous avez déjà un compte ?{' '}
            <Link href="/login" className="font-semibold text-cmgreen-700 hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
