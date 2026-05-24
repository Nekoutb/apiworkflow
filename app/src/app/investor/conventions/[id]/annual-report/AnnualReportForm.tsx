'use client';

import { useActionState } from 'react';
import { submitAnnualReportAction } from '@/lib/actions/obligations';
import { initialState, type ActionState } from '@/lib/obligations-config';

type Existing = {
  fiscalYear: number;
  jobsActual: number | null;
  investmentActualFcfa: string | null;
  exportsActualFcfa: string | null;
  localPurchasesFcfa: string | null;
  notes: string | null;
  isLate: boolean;
  monthsLate: number;
  fineAccruedFcfa: string;
} | null;

export function AnnualReportForm({
  conventionId, yearOptions, defaultYear, existing,
}: {
  conventionId: string;
  yearOptions: number[];
  defaultYear: number;
  existing: Existing;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitAnnualReportAction,
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

      {existing?.isLate && (
        <div className="border-l-4 border-cmred bg-cmred-50 px-4 py-3 text-[12.5px] text-ink-2">
          <strong className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-cmred">
            Rapport en retard
          </strong>
          {existing.monthsLate} mois de retard · pénalité accumulée {formatFcfaShort(existing.fineAccruedFcfa)}.
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Select id="fiscalYear" label="Exercice fiscal *" required defaultValue={String(defaultYear)}>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Field
          id="jobsActual"
          label="Emplois créés (effectif)"
          type="number"
          placeholder="ex. 68"
          defaultValue={existing?.jobsActual?.toString()}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Fcfa
          id="investmentActualFcfa"
          label="Investissement réalisé (FCFA)"
          defaultValue={existing?.investmentActualFcfa ?? undefined}
        />
        <Fcfa
          id="exportsActualFcfa"
          label="Exports réalisés (FCFA)"
          defaultValue={existing?.exportsActualFcfa ?? undefined}
        />
      </div>

      <Fcfa
        id="localPurchasesFcfa"
        label="Achats locaux (FCFA, sous-traitance camerounaise)"
        defaultValue={existing?.localPurchasesFcfa ?? undefined}
      />

      <div>
        <label htmlFor="notes" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Faits marquants / difficultés rencontrées
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={5}
          defaultValue={existing?.notes ?? ''}
          placeholder="Bilan qualitatif, écarts vs prévisions, actions correctives prévues…"
          className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
      </div>

      <FileField id="attachment" label="Pièce jointe (rapport détaillé, PDF, 10 Mo max)" />

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cmgreen-800 py-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
      >
        {pending ? 'Transmission…' : existing ? 'Mettre à jour le rapport →' : 'Transmettre le rapport →'}
      </button>
    </form>
  );
}

function Field({ id, label, type = 'text', placeholder, defaultValue, required }: { id: string; label: string; type?: string; placeholder?: string; defaultValue?: string; required?: boolean }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">{label}</label>
      <input id={id} name={id} type={type} placeholder={placeholder} defaultValue={defaultValue} required={required}
        className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800" />
    </div>
  );
}

function Fcfa({ id, label, defaultValue }: { id: string; label: string; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">{label}</label>
      <div className="flex items-stretch border border-line-2 bg-white focus-within:border-cmgreen-800 focus-within:ring-1 focus-within:ring-cmgreen-800">
        <input id={id} name={id} type="number" min={0} step={1} defaultValue={defaultValue} placeholder="0"
          className="w-full bg-transparent px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:outline-none" />
        <span className="flex items-center border-l border-line bg-bgsoft px-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-3">FCFA</span>
      </div>
    </div>
  );
}

function Select({ id, label, defaultValue, required, children }: { id: string; label: string; defaultValue?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">{label}</label>
      <select id={id} name={id} defaultValue={defaultValue} required={required}
        className="w-full appearance-none border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800">
        {children}
      </select>
    </div>
  );
}

function FileField({ id, label }: { id: string; label: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">{label}</label>
      <input id={id} name={id} type="file" accept="application/pdf"
        className="block w-full text-[12.5px] text-ink file:mr-3 file:border file:border-line-2 file:bg-white file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:uppercase file:tracking-[0.12em] file:text-ink-2 hover:file:border-ink hover:file:text-ink" />
    </div>
  );
}

function formatFcfaShort(s: string): string {
  try {
    const n = BigInt(s);
    if (n >= 1_000_000n) return `${(Number(n) / 1_000_000).toFixed(0)} M FCFA`;
    return `${Number(n).toLocaleString('fr-FR')} FCFA`;
  } catch { return s; }
}
