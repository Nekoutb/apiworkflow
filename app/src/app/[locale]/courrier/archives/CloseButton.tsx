'use client';

import { useTransition, useState } from 'react';
import { closeDocument } from '@/lib/actions/courrier-archives';

export function CloseButton({
  documentId,
  reference,
}: {
  documentId: string;
  reference: string;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!confirm(`Clôturer définitivement ${reference} et le déplacer dans les archives ?`)) return;
    start(async () => {
      const res = await closeDocument(documentId);
      if (res.ok) setDone(true);
      else setError(res.error ?? 'Erreur');
    });
  }

  if (done) {
    return (
      <span className="inline-block bg-cmgreen-50 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmgreen-900">
        ✓ Clos
      </span>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="border border-cmgreen-800 bg-white px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 hover:bg-cmgreen-800 hover:text-white disabled:opacity-50"
      >
        {pending ? '…' : 'Clôturer'}
      </button>
      {error && <div className="mt-1 text-[11px] text-cmred">{error}</div>}
    </div>
  );
}
