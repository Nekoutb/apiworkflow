'use client';

import { useActionState } from 'react';
import { loginAction, type LoginActionState } from '@/lib/actions/auth-actions';

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      {state.formError && (
        <div className="rounded-lg border border-danger bg-danger-bg p-3 text-sm text-danger">
          {state.formError}
        </div>
      )}

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
        {state.errors?.email?.length ? (
          <p className="mt-1 text-xs text-danger">{state.errors.email[0]}</p>
        ) : null}
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
        {state.errors?.password?.length ? (
          <p className="mt-1 text-xs text-danger">{state.errors.password[0]}</p>
        ) : null}
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
        {pending ? 'Connexion…' : 'Se connecter →'}
      </button>
    </form>
  );
}
