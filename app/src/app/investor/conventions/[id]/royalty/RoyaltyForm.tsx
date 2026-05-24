'use client';

import { useActionState } from 'react';
import { declareRoyaltyAction } from '@/lib/actions/obligations';
import { initialState, type ActionState } from '@/lib/obligations-config';

type Existing = {
  fiscalYear: number;
  amountPaidFcfa: string | null;
  paidAt: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'PAID';
} | null;

export function RoyaltyForm({
  conventionId, years, defaultYear, amountDueFcfaStr, existing,
}: {
  conventionId: string;
  years: number[];
  defaultYear: number;
  amountDueFcfaStr: string;
  existing: Existing;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    declareRoyaltyAction,
    initialState,
  );

  const isPaid = existing?.status === 'PAID';

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="conventionId" value={conventionId} />

      {state.status === 'error' && (
        <div className="border border-cmred bg-cmred-50 px-4 py-3 text-[13px] font-medium text-cmred">
          {state.error}
        </div>
      )}

      {isPaid && (
        <div className="border-l-4 border-cmgreen-700 bg-cmgreen-50 px-4 py-3 text-[12.5px] text-ink-2">
          <strong className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800">
            Déjà payée
          </strong>
          Redevance pour l&apos;exercice {existing?.fiscalYear} marquée comme payée
          {existing?.paidAt && ` le ${new Date(existing.paidAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}`}.
        </div>
      )}

      <div>
        <label htmlFor="fiscalYear" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Exercice fiscal *
        </label>
        <select
          id="fiscalYear"
          name="fiscalYear"
          required
          defaultValue={String(defaultYear)}
          className="w-full appearance-none border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        >
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="border border-line bg-bgsoft p-4">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">Montant à régler</div>
        <div className="serif mt-1 text-[28px] font-bold tracking-[-0.3px] text-cmgreen-800 tabular">
          {Number(amountDueFcfaStr).toLocaleString('fr-FR')} FCFA
        </div>
        <div className="mt-1 text-[11px] italic text-ink-3">
          Calculé selon Art. 48 (0,1 % du montant agréé, plancher 100 k, plafond 5 M).
        </div>
      </div>

      <div>
        <label htmlFor="amountPaidFcfa" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Montant effectivement versé (FCFA)
        </label>
        <div className="flex items-stretch border border-line-2 bg-white focus-within:border-cmgreen-800 focus-within:ring-1 focus-within:ring-cmgreen-800">
          <input
            id="amountPaidFcfa"
            name="amountPaidFcfa"
            type="number"
            min={0}
            step={1}
            defaultValue={existing?.amountPaidFcfa ?? amountDueFcfaStr}
            className="w-full bg-transparent px-3.5 py-2.5 text-[14px] text-ink focus:outline-none"
          />
          <span className="flex items-center border-l border-line bg-bgsoft px-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-3">FCFA</span>
        </div>
        <p className="mt-1.5 text-[11.5px] italic text-ink-3">
          Laissez vide pour enregistrer une déclaration sans paiement (status : en attente).
        </p>
      </div>

      <div>
        <label htmlFor="proof" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Justificatif de paiement (PDF, optionnel)
        </label>
        <input
          id="proof"
          name="proof"
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
        {pending ? 'Enregistrement…' : 'Enregistrer la déclaration →'}
      </button>
    </form>
  );
}
