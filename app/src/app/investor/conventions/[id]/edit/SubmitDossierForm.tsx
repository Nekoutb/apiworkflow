'use client';

import { useActionState } from 'react';
import { submitConventionAction } from '@/lib/actions/convention';
import { initialSubmitState, type SubmitConventionState } from '@/lib/convention-config';

export function SubmitDossierForm({
  conventionId,
  ready,
  missingCount,
}: {
  conventionId: string;
  ready: boolean;
  missingCount: number;
}) {
  const [state, formAction, pending] = useActionState<SubmitConventionState, FormData>(
    submitConventionAction,
    initialSubmitState,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center justify-between gap-4 border-t border-line bg-bgsoft px-6 py-4">
      <input type="hidden" name="conventionId" value={conventionId} />

      <div className="text-[12.5px] italic text-ink-3">
        {ready ? (
          <>
            Statut&nbsp;:{' '}
            <strong className="not-italic font-semibold text-cmgreen-800">
              prêt pour soumission au Secrétariat
            </strong>
          </>
        ) : (
          <>
            Statut&nbsp;:{' '}
            <strong className="not-italic font-semibold text-ink-2">
              {missingCount} pièce{missingCount > 1 ? 's' : ''} manquante{missingCount > 1 ? 's' : ''}
            </strong>{' '}
            — la soumission s&apos;active automatiquement.
          </>
        )}
        {state.status === 'error' && (
          <div className="mt-1 text-[12px] not-italic text-cmred">{state.error}</div>
        )}
      </div>

      <button
        type="submit"
        disabled={!ready || pending}
        className={
          'px-6 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] transition ' +
          (ready && !pending
            ? 'bg-gold-600 text-obsidian hover:bg-gold-500'
            : 'bg-gold-600 text-obsidian opacity-40 cursor-not-allowed')
        }
      >
        {pending ? 'Soumission…' : 'Soumettre au Secrétariat →'}
      </button>
    </form>
  );
}
