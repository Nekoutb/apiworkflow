'use client';

import { useActionState } from 'react';
import { submitAttestationAction } from '@/lib/actions/obligations';
import { initialState, type ActionState } from '@/lib/obligations-config';

type Existing = {
  expectedCompletionDate: string;
  notes: string | null;
  status: string;
  inspectionScheduledAt: string | null;
} | null;

export function AttestationForm({ conventionId, existing }: { conventionId: string; existing: Existing }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitAttestationAction,
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

      {existing?.inspectionScheduledAt && (
        <div className="border-l-4 border-cmgreen-700 bg-cmgreen-50 px-4 py-3 text-[12.5px] text-ink-2">
          <strong className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800">
            Visite programmée
          </strong>
          La visite conjointe API + DGI + DGD est programmée le{' '}
          <strong>{new Date(existing.inspectionScheduledAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>.
        </div>
      )}

      <div>
        <label htmlFor="expectedCompletionDate" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Date d&apos;achèvement prévue *
        </label>
        <input
          id="expectedCompletionDate"
          name="expectedCompletionDate"
          type="date"
          required
          defaultValue={existing?.expectedCompletionDate}
          className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
        <p className="mt-1.5 text-[11.5px] italic text-ink-3">
          Le Guichet Unique programmera la visite conjointe autour de cette date.
        </p>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Description de l&apos;état d&apos;avancement
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={6}
          defaultValue={existing?.notes ?? ''}
          placeholder="Étapes terminées, équipements installés, infrastructures livrées, photos disponibles sur place…"
          className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
      </div>

      <div>
        <label htmlFor="attachment" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Dossier photo / rapport d&apos;achèvement (PDF, optionnel)
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
        {pending ? 'Transmission…' : existing ? 'Mettre à jour la demande →' : 'Demander l\'attestation →'}
      </button>
    </form>
  );
}
