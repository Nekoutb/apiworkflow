'use client';

import { useActionState, useEffect, useRef } from 'react';
import { createAntenne, type AntenneActionState } from '@/lib/actions/antennes';

const initial: AntenneActionState = {};

export function CreateAntenneForm() {
  const [state, formAction, pending] = useActionState(createAntenne, initial);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <details className="border border-line bg-white">
      <summary className="cursor-pointer list-none border-b border-line bg-bgsoft px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.16em] text-ink-2 transition hover:text-ink">
        <span className="mr-2 inline-block group-open:rotate-90">▶</span>
        Ajouter une antenne régionale
      </summary>
      <form ref={ref} action={formAction} className="grid gap-3 px-5 py-5 md:grid-cols-4">
        {state.error && (
          <div className="md:col-span-4 border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="md:col-span-4 border border-cmgreen-800 bg-cmgreen-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmgreen-900">
            ✓ Antenne créée.
          </div>
        )}

        <input
          name="name"
          required
          placeholder="Nom · ex. Antenne Centre"
          className="border border-line-2 bg-white px-3 py-2 text-[13px] focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
        <input
          name="region"
          required
          placeholder="Région · ex. Centre"
          className="border border-line-2 bg-white px-3 py-2 text-[13px] focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
        <input
          name="ville"
          placeholder="Ville · ex. Yaoundé"
          className="border border-line-2 bg-white px-3 py-2 text-[13px] focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-blue-700 px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-blue-800 disabled:opacity-50"
        >
          {pending ? 'Création…' : 'Créer'}
        </button>
        {(state.fieldErrors?.name || state.fieldErrors?.region) && (
          <div className="md:col-span-4 text-[11.5px] font-medium text-cmred">
            {state.fieldErrors?.name ?? state.fieldErrors?.region}
          </div>
        )}
      </form>
    </details>
  );
}
