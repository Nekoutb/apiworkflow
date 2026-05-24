'use client';

import { useActionState, useState } from 'react';
import { submitEquipmentListAction } from '@/lib/actions/obligations';
import { initialState, type ActionState } from '@/lib/obligations-config';

type Item = { description: string; qty: number; hsCode: string; unitValueFcfa: number };

export function EquipmentListForm({
  conventionId, existingItems,
}: {
  conventionId: string;
  existingItems: Item[] | null;
}) {
  const [items, setItems] = useState<Item[]>(
    existingItems && existingItems.length > 0
      ? existingItems.map((i) => ({ description: i.description ?? '', qty: i.qty ?? 1, hsCode: i.hsCode ?? '', unitValueFcfa: i.unitValueFcfa ?? 0 }))
      : [{ description: '', qty: 1, hsCode: '', unitValueFcfa: 0 }],
  );
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitEquipmentListAction,
    initialState,
  );

  const total = items.reduce((acc, it) => acc + BigInt(Math.max(0, it.qty)) * BigInt(Math.max(0, it.unitValueFcfa)), 0n);

  const updateItem = (idx: number, patch: Partial<Item>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const addItem    = () => setItems((prev) => [...prev, { description: '', qty: 1, hsCode: '', unitValueFcfa: 0 }]);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="conventionId" value={conventionId} />
      <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />

      {state.status === 'error' && (
        <div className="border border-cmred bg-cmred-50 px-4 py-3 text-[13px] font-medium text-cmred">
          {state.error}
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="serif text-[16px] font-bold text-ink">Équipements et matériels</h3>
          <button
            type="button"
            onClick={addItem}
            className="border border-line-2 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink"
          >
            + Ligne
          </button>
        </div>

        <div className="overflow-x-auto border border-line">
          <table className="w-full">
            <thead className="bg-bgsoft">
              <tr className="text-left">
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">Description</th>
                <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">Code SH</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">Qté</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">PU FCFA</th>
                <th className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.12em] text-ink-3">Total</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => {
                const line = BigInt(Math.max(0, it.qty)) * BigInt(Math.max(0, it.unitValueFcfa));
                return (
                  <tr key={i} className="border-t border-line">
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={it.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        placeholder="Ex. Tour CNC 5 axes"
                        className="w-full border border-line-2 bg-white px-2 py-1.5 text-[13px] text-ink focus:border-cmgreen-800 focus:outline-none"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="text"
                        value={it.hsCode}
                        onChange={(e) => updateItem(i, { hsCode: e.target.value })}
                        placeholder="8457.10"
                        className="w-28 border border-line-2 bg-white px-2 py-1.5 font-mono text-[12px] text-ink focus:border-cmgreen-800 focus:outline-none"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        min={1}
                        value={it.qty || ''}
                        onChange={(e) => updateItem(i, { qty: Number(e.target.value) || 0 })}
                        className="w-20 border border-line-2 bg-white px-2 py-1.5 text-right text-[13px] text-ink focus:border-cmgreen-800 focus:outline-none"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type="number"
                        min={0}
                        value={it.unitValueFcfa || ''}
                        onChange={(e) => updateItem(i, { unitValueFcfa: Number(e.target.value) || 0 })}
                        className="w-32 border border-line-2 bg-white px-2 py-1.5 text-right font-mono text-[12px] text-ink focus:border-cmgreen-800 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12px] text-ink-2 tabular">
                      {Number(line).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        disabled={items.length === 1}
                        title="Retirer la ligne"
                        className="text-[16px] text-ink-3 hover:text-cmred disabled:opacity-30"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-bgsoft">
              <tr className="border-t border-line">
                <td colSpan={4} className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
                  Total liste
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold text-ink tabular">
                  {Number(total).toLocaleString('fr-FR')} FCFA
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div>
        <label htmlFor="attachment" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
          Pièce jointe (PDF, devis ou catalogue, optionnel)
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
        {pending ? 'Transmission…' : 'Transmettre la liste à l\'API + DGD →'}
      </button>
    </form>
  );
}
