'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signupAction } from '@/lib/actions/signup';
import {
  initialSignupState,
  SIGNUP_LEGAL_FORMS,
  SIGNUP_REGIONS,
  type SignupState,
} from '@/lib/signup-config';

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(
    signupAction,
    initialSignupState,
  );

  const v = state.status === 'error' ? state.values ?? {} : {};

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && (
        <div className="border border-cmred bg-cmred-50 px-4 py-3 text-[13px] font-medium text-cmred">
          {state.error}
        </div>
      )}

      <Field id="raisonSociale" label="Raison sociale *" required placeholder="Ex. TechCam SARL" defaultValue={v.raisonSociale} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          id="legalForm"
          label="Forme juridique *"
          required
          defaultValue={v.legalForm ?? ''}
          options={['', ...SIGNUP_LEGAL_FORMS] as readonly string[]}
          placeholderOption="— Sélectionner —"
        />
        <Field id="niu" label="NIU (optionnel)" placeholder="M0214…" defaultValue={v.niu} />
      </div>

      <Field
        id="contactName"
        label="Nom du contact *"
        required
        placeholder="Prénom NOM"
        defaultValue={v.contactName}
      />

      <Field
        id="email"
        label="Adresse email *"
        type="email"
        required
        placeholder="contact@entreprise.cm"
        defaultValue={v.email}
        hint="Servira d'identifiant de connexion."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          id="region"
          label="Région *"
          required
          defaultValue={v.region ?? ''}
          options={['', ...SIGNUP_REGIONS] as readonly string[]}
          placeholderOption="— Sélectionner —"
        />
        <Field id="city" label="Ville *" required placeholder="Yaoundé" defaultValue={v.city} />
      </div>

      <Field
        id="contactPhone"
        label="Téléphone (optionnel)"
        type="tel"
        placeholder="+237 6 XX XX XX XX"
        defaultValue={v.contactPhone}
      />

      <div className="border-l-4 border-gold-600 bg-gold-50/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
        <strong className="block text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
          Phase de construction
        </strong>
        Le mot de passe est temporairement défini à <code className="font-mono text-ink">admin</code> pour faciliter
        les tests. La création d'un mot de passe personnel sera activée au lancement officiel.
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cmgreen-800 py-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
      >
        {pending ? 'Création du compte…' : 'Créer mon espace investisseur →'}
      </button>

      <p className="text-center text-[12.5px] text-ink-3">
        Déjà inscrit ?{' '}
        <Link href="/login?type=investor" className="font-semibold text-cmgreen-800 hover:underline">
          Connectez-vous
        </Link>
      </p>
    </form>
  );
}

function Field({
  id, label, type = 'text', placeholder, required, defaultValue, hint,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
      />
      {hint && <div className="mt-1.5 text-[11.5px] italic text-ink-3">{hint}</div>}
    </div>
  );
}

function Select({
  id, label, required, defaultValue, options, placeholderOption,
}: {
  id: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  options: readonly string[];
  placeholderOption?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
      >
        {label}
      </label>
      <select
        id={id}
        name={id}
        required={required}
        defaultValue={defaultValue}
        className="w-full appearance-none border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
      >
        {options.map((o) =>
          o === '' ? (
            <option key="placeholder" value="" disabled>
              {placeholderOption ?? '—'}
            </option>
          ) : (
            <option key={o} value={o}>
              {o}
            </option>
          ),
        )}
      </select>
    </div>
  );
}
