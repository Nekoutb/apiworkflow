'use client';

import { useActionState } from 'react';
import { submitExtensionAction } from '@/lib/actions/obligations';
import { initialState, EXTENSION_MONTHS_MAX, type ActionState } from '@/lib/obligations-config';

export function ExtensionForm({ conventionId }: { conventionId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitExtensionAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="conventionId" value={conventionId} />

      {state.status === 'error' && (
        <div className="border border-cmred bg-cmred-50 px-4 py-3 text-[13px] font-medium text-cmred">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="requestedMonths" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Durée d&apos;extension demandée *
        </label>
        <div className="flex items-stretch border border-line-2 bg-white focus-within:border-cmgreen-800 focus-within:ring-1 focus-within:ring-cmgreen-800">
          <input
            id="requestedMonths"
            name="requestedMonths"
            type="number"
            required
            min={1}
            max={EXTENSION_MONTHS_MAX}
            placeholder="12"
            className="w-full bg-transparent px-3.5 py-2.5 text-[14px] text-ink focus:outline-none"
          />
          <span className="flex items-center border-l border-line bg-bgsoft px-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-3">mois</span>
        </div>
        <p className="mt-1.5 text-[11.5px] italic text-ink-3">
          Maximum {EXTENSION_MONTHS_MAX} mois, non-renouvelable (Art. 36.3).
        </p>
      </div>

      <div>
        <label htmlFor="reason" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Motivation détaillée *
        </label>
        <textarea
          id="reason"
          name="reason"
          required
          minLength={20}
          rows={7}
          placeholder="Décrivez la force majeure ou la difficulté économique. Quantifiez l'impact, joignez les pièces de preuve dans le champ suivant."
          className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
        <p className="mt-1.5 text-[11.5px] italic text-ink-3">
          Minimum 20 caractères. Doit permettre au Guichet Unique de qualifier la cause.
        </p>
      </div>

      <div>
        <label htmlFor="attachment" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Pièces justificatives (PDF unique, 10 Mo max)
        </label>
        <input
          id="attachment"
          name="attachment"
          type="file"
          accept="application/pdf"
          className="block w-full text-[12.5px] text-ink file:mr-3 file:border file:border-line-2 file:bg-white file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:uppercase file:tracking-[0.12em] file:text-ink-2 hover:file:border-ink hover:file:text-ink"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cmgreen-800 py-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
      >
        {pending ? 'Transmission…' : 'Transmettre la demande →'}
      </button>
    </form>
  );
}
