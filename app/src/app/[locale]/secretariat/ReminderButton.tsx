'use client';

import { useState, useTransition } from 'react';
import { sendReminder } from '@/lib/actions/secretariat-reminder';

export function ReminderButton({ documentId }: { documentId: string }) {
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
        setError(result.error);
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
        title={`Notification envoyée à ${recipientCount} destinataire${recipientCount > 1 ? 's' : ''}`}
      >
        ✓ Envoyé · {recipientCount}
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
        title="Envoyer un rappel au détenteur du dossier"
      >
        {pending ? '…' : '🔔 Rappeler'}
      </button>
      {error && (
        <span className="text-[9.5px] italic text-cmred" title={error}>
          {error.slice(0, 40)}{error.length > 40 ? '…' : ''}
        </span>
      )}
    </div>
  );
}
