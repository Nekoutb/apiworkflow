'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { changeMyPassword, type ChangePasswordState } from '@/lib/actions/settings';

const initial: ChangePasswordState = {};

export function PasswordCard() {
  const t = useTranslations('Settings');
  const tErrors = useTranslations('Errors');
  const [state, action, pending] = useActionState(changeMyPassword, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  // Map an error key returned by the action to a localised message.
  const fieldErr = (key?: string) => {
    if (!key) return null;
    if (key === 'required') return tErrors('invalidData');
    // keys below all exist in the Errors namespace
    return tErrors(key as 'passwordWrong' | 'passwordTooShort' | 'passwordMismatch');
  };

  const inputCls =
    'w-full rounded-lg border border-line-2 bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600';

  return (
    <form ref={formRef} action={action} className="space-y-4">
      {state.ok && (
        <div className="rounded-lg border border-cmgreen-800 bg-cmgreen-50 px-3.5 py-2.5 text-[12.5px] font-semibold text-cmgreen-900">
          {t('savedToast')}
        </div>
      )}

      <Field label={t('passwordOld')} error={fieldErr(state.fieldErrors?.oldPassword)}>
        <input type="password" name="oldPassword" autoComplete="current-password" required className={inputCls} />
      </Field>

      <Field label={t('passwordNew')} error={fieldErr(state.fieldErrors?.newPassword)}>
        <input type="password" name="newPassword" autoComplete="new-password" required minLength={8} className={inputCls} />
      </Field>

      <Field label={t('passwordConfirm')} error={fieldErr(state.fieldErrors?.confirmPassword)}>
        <input type="password" name="confirmPassword" autoComplete="new-password" required minLength={8} className={inputCls} />
      </Field>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-blue-700 px-5 py-2.5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? '…' : t('passwordChange')}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-2">
        {label}
      </label>
      {children}
      {error && <div className="mt-1 text-[11.5px] font-medium text-cmred">{error}</div>}
    </div>
  );
}
