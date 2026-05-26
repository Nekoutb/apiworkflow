'use client';

import { useTransition, useState } from 'react';
import { markDecidedForTesting } from '@/lib/actions/courrier-depart';

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: 'Reçu',
  AWAITING_DG_ANALYSIS: 'Chez DG · analyse',
  ASSIGNED: 'Affecté',
  IN_TREATMENT: 'En traitement',
  AWAITING_EXTERNAL_AVIS: 'Attente avis externe',
  AWAITING_DG_DECISION: 'Attente décision DG',
};

export function AdminMarkDecidedRow({
  doc,
}: {
  doc: { id: string; reference: string; subject: string; status: string };
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function promote() {
    if (!confirm(`Promouvoir ${doc.reference} au statut DECIDED (raccourci de test) ?`)) return;
    start(async () => {
      const res = await markDecidedForTesting(doc.id);
      if (res.ok) setDone(true);
      else setError(res.error ?? 'Erreur');
    });
  }

  if (done) {
    return (
      <tr className="border-t border-line align-top bg-cmgreen-50">
        <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">{doc.reference}</td>
        <td className="px-4 py-3 text-[12.5px] text-ink-2">
          <div className="max-w-md truncate" title={doc.subject}>{doc.subject}</div>
        </td>
        <td className="px-4 py-3 text-[11px]">
          <span className="bg-cmgreen-50 px-2 py-0.5 font-bold uppercase tracking-[0.1em] text-[10px] text-cmgreen-900">
            ✓ DECIDED
          </span>
        </td>
        <td className="px-4 py-3 text-[11px] italic text-cmgreen-900">
          Promu — réactualisez la page pour le voir dans la file
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-t border-line align-top">
      <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">{doc.reference}</td>
      <td className="px-4 py-3 text-[12.5px] text-ink-2">
        <div className="max-w-md truncate" title={doc.subject}>{doc.subject}</div>
      </td>
      <td className="px-4 py-3 text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
        {STATUS_LABEL[doc.status] ?? doc.status}
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={promote}
          disabled={pending}
          className="border border-gold-700 bg-white px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-700 hover:bg-gold-700 hover:text-white disabled:opacity-50"
        >
          {pending ? '…' : 'Marquer DECIDED'}
        </button>
        {error && <div className="mt-1 text-[11px] text-cmred">{error}</div>}
      </td>
    </tr>
  );
}
