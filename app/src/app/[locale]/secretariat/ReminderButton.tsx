'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { sendReminder } from '@/lib/actions/secretariat-reminder';

export function ReminderButton({ documentId }: { documentId: string }) {
  const t = useTranslations('Secretariat');
  const tErrors = useTranslations('Errors');
  const [pending, start] = useTransition();
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState<number>(0);

  function handleClick() {
    setState('idle');
    setError(null);
    start(async () => {
      const result = await sendReminder(documentId);
      if (result.error) {
        // Map known error strings → i18n keys (server still returns FR strings
        // pending P4; if the message matches a known phrase, swap it for the
        // current locale's version).
        const localised =
          result.error.includes('périmètre') || result.error.includes('scope')
            ? tErrors('outOfScope')
            : result.error.includes('détenteur') || result.error.includes('holder')
              ? tErrors('noCurrentHolder')
              : result.error.includes('introuvable') || result.error.includes('not found')
                ? tErrors('documentNotFound')
                : result.error;
        setError(localised);
        setState('error');
        return;
      }
      setRecipientCount(result.recipients ?? 0);
      setState('sent');
    });
  }

  if (state === 'sent') {
    return (
      <span
        className="inline-flex items-center gap-1 border border-cmgreen-800 bg-cmgreen-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-cmgreen-900"
        title={t('reminderSent', { count: recipientCount })}
      >
        {t('reminderSent', { count: recipientCount })}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={
          'border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] transition disabled:opacity-50 ' +
          (state === 'error'
            ? 'border-cmred bg-cmred-50 text-cmred hover:bg-cmred hover:text-white'
            : 'border-gold-700 bg-white text-gold-700 hover:bg-gold-700 hover:text-white')
        }
        title={t('reminderTooltip')}
      >
        {pending ? t('reminderSending') : t('reminderButton')}
      </button>
      {error && (
        <span className="text-[9.5px] italic text-cmred" title={error}>
          {error.slice(0, 40)}{error.length > 40 ? '…' : ''}
        </span>
      )}
    </div>
  );
}
