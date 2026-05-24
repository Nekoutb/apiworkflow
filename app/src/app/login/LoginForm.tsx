'use client';

import { useActionState } from 'react';
import { loginAction, type LoginActionState } from '@/lib/actions/auth';

const initialState: LoginActionState = {};

type Tab = 'investor' | 'staff';

export function LoginForm({ tab = 'staff' }: { tab?: Tab }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  // Staff get the admin/admin default so a single click reproduces the A1 demo.
  // Investors land on an empty form so they type their own email.
  const defaultEmail = tab === 'staff' ? 'admin' : '';
  const defaultPwd   = 'admin';

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="border border-cmred bg-cmred-50 px-4 py-3 text-[13px] font-medium text-cmred">
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
        >
          {tab === 'investor' ? 'Email de connexion' : 'Identifiant'}
        </label>
        <input
          id="email"
          name="email"
          type="text"
          required
          autoComplete="username"
          defaultValue={defaultEmail}
          placeholder={tab === 'investor' ? 'contact@entreprise.cm' : 'admin'}
          className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
        {tab === 'staff' && (
          <div className="mt-1.5 text-[11px] italic text-ink-3">
            Astuce dev&nbsp;: <code className="not-italic font-mono">admin</code>,{' '}
            <code className="not-italic font-mono">secretariat</code>,{' '}
            <code className="not-italic font-mono">dg</code>… → @api.cm est ajouté automatiquement.
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
        >
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          defaultValue={defaultPwd}
          placeholder="••••••••"
          className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cmgreen-800 py-3 text-[13px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
      >
        {pending ? 'Connexion…' : 'Se connecter →'}
      </button>
    </form>
  );
}
