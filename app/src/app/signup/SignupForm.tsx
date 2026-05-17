'use client';

import { useActionState } from 'react';
import { signupAction, type SignupActionState } from '@/lib/actions/auth-actions';

const initialState: SignupActionState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.formError && (
        <div className="rounded-lg border border-danger bg-danger-bg p-3 text-sm text-danger">
          {state.formError}
        </div>
      )}

      <Field label="Nom complet" name="fullName" required errors={state.errors?.fullName} placeholder="Jean Mboma" />
      <Field label="Raison sociale" name="raisonSociale" required errors={state.errors?.raisonSociale} placeholder="SARL Mboma Industries" />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Forme juridique" name="legalForm" errors={state.errors?.legalForm} placeholder="SARL / SA / SUARL" />
        <Field label="NIU (si déjà attribué)" name="niu" errors={state.errors?.niu} placeholder="M0XXXXXXXXXXXC" />
      </div>

      <Field label="Téléphone de contact" name="contactPhone" errors={state.errors?.contactPhone} placeholder="+237 6 XX XX XX XX" />

      <Field label="Adresse email" name="email" type="email" required errors={state.errors?.email} autoComplete="email" />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Mot de passe" name="password" type="password" required errors={state.errors?.password} autoComplete="new-password" />
        <Field label="Confirmation" name="passwordConfirm" type="password" required errors={state.errors?.passwordConfirm} autoComplete="new-password" />
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
        {pending ? 'Création en cours…' : 'Créer mon compte →'}
      </button>

      <p className="text-xs text-ink-muted">
        En créant un compte, vous acceptez la politique de confidentialité (Loi 2010/012) et
        les obligations de lutte contre le blanchiment des capitaux (Art. 49 de l&apos;Ordonnance).
      </p>
    </form>
  );
}

function Field({
  label, name, type = 'text', required, errors, placeholder, autoComplete,
}: {
  label: string; name: string; type?: string; required?: boolean;
  errors?: string[]; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wider text-ink">
        {label}{required ? <span className="text-cmred"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-sm focus:border-cmgreen-700 focus:outline-none focus:ring-2 focus:ring-cmgreen-700/15"
      />
      {errors?.length ? (
        <p className="mt-1 text-xs text-danger">{errors[0]}</p>
      ) : null}
    </div>
  );
}
