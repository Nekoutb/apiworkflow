'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { loginAction, type LoginActionState } from '@/lib/actions/auth';

const initialState: LoginActionState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const t = useTranslations('Login');

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="border border-cmred bg-cmred-50 px-4 py-3 text-[13px] font-medium text-cmred">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          {t('identifierLabel')}
        </label>
        <input
          id="email"
          name="email"
          type="text"
          required
          autoComplete="username"
          defaultValue="admin"
          placeholder="admin"
          className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
        <div
          className="mt-1.5 text-[11px] italic text-ink-3"
          dangerouslySetInnerHTML={{
            __html: t
              .raw('identifierHint')
              .replace(/<bold>/g, '<code class="not-italic font-mono">')
              .replace(/<\/bold>/g, '</code>'),
          }}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          {t('passwordLabel')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          defaultValue="admin"
          placeholder="••••••••"
          className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cmgreen-800 py-3 text-[13px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
      >
        {pending ? t('submittingButton') : `${t('submitButton')} →`}
      </button>
    </form>
  );
}
