'use client';

import { useState, useTransition } from 'react';
import { acceptDocumentAction, rejectDocumentAction } from '@/lib/actions/staff-workflow';

export type DocumentTileData = {
  id: string;
  kind: string;
  title: string;
  article: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
  verification: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedByName: string | null;
};

export function DocumentTile({
  index,
  doc,
  canEdit,
}: {
  index: number;
  doc: DocumentTileData;
  canEdit: boolean;
}) {
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState(doc.rejectionReason ?? '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accept = () => {
    if (!canEdit) return;
    const fd = new FormData();
    fd.set('documentId', doc.id);
    setError(null);
    startTransition(async () => {
      try { await acceptDocumentAction(fd); } catch (e) { setError((e as Error).message); }
    });
  };

  const reject = () => {
    if (!canEdit) return;
    if (reason.trim().length < 5) {
      setError('Motif d\'au moins 5 caractères.');
      return;
    }
    const fd = new FormData();
    fd.set('documentId', doc.id);
    fd.set('reason', reason.trim());
    setError(null);
    startTransition(async () => {
      try { await rejectDocumentAction(fd); setShowReject(false); }
      catch (e) { setError((e as Error).message); }
    });
  };

  const state = doc.verification;

  return (
    <li className={
      'border bg-white ' +
      (state === 'ACCEPTED' ? 'border-cmgreen-700' :
       state === 'REJECTED' ? 'border-cmred' :
       'border-line')
    }>
      <div className="flex items-start gap-4 px-5 py-4">
        <div className={
          'flex h-10 w-10 flex-none items-center justify-center font-display text-[14px] font-bold italic ' +
          (state === 'ACCEPTED' ? 'border border-cmgreen-700 bg-cmgreen-50 text-cmgreen-800' :
           state === 'REJECTED' ? 'border border-cmred bg-cmred-50 text-cmred' :
           'border border-line-2 bg-bgsoft text-ink-3')
        }>
          {state === 'ACCEPTED' ? '✓' : state === 'REJECTED' ? '×' : romanIndex(index)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[14px] font-semibold text-ink">{doc.title}</span>
            <span className="font-mono text-[10.5px] text-ink-3">{doc.article}</span>
            {state === 'ACCEPTED' && (
              <span className="inline-block border border-cmgreen-700 bg-cmgreen-50 px-1.5 py-0 text-[9.5px] font-bold uppercase tracking-[0.12em] text-cmgreen-800">
                Acceptée
              </span>
            )}
            {state === 'REJECTED' && (
              <span className="inline-block border border-cmred bg-cmred-50 px-1.5 py-0 text-[9.5px] font-bold uppercase tracking-[0.12em] text-cmred">
                Rejetée
              </span>
            )}
            {state === 'PENDING' && (
              <span className="inline-block border border-line-2 bg-bgsoft px-1.5 py-0 text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-3">
                À vérifier
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[11.5px] text-ink-3">
            <span className="font-mono">{doc.fileName}</span>
            <span className="mx-1.5 text-ink-4">·</span>
            <span>{formatSize(doc.sizeBytes)}</span>
            <span className="mx-1.5 text-ink-4">·</span>
            <span>déposée {formatRelative(doc.uploadedAt)}</span>
          </div>
          {state === 'REJECTED' && doc.rejectionReason && !showReject && (
            <div className="mt-1.5 text-[11.5px] italic text-cmred">
              « {doc.rejectionReason} »
              {doc.verifiedByName && <span className="not-italic text-ink-4"> — {doc.verifiedByName}</span>}
            </div>
          )}
          {state === 'ACCEPTED' && doc.verifiedByName && (
            <div className="mt-1 text-[11px] italic text-ink-4">
              Validée par {doc.verifiedByName} {doc.verifiedAt && `· ${formatRelative(doc.verifiedAt)}`}
            </div>
          )}
          {error && <div className="mt-1 text-[11px] italic text-cmred">{error}</div>}
        </div>

        {canEdit && !showReject && (
          <div className="flex flex-none flex-col gap-1.5">
            <button
              type="button"
              onClick={accept}
              disabled={pending || state === 'ACCEPTED'}
              className={
                'px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] transition disabled:opacity-50 ' +
                (state === 'ACCEPTED'
                  ? 'border border-cmgreen-700 bg-white text-cmgreen-800'
                  : 'border border-cmgreen-700 bg-white text-cmgreen-800 hover:bg-cmgreen-50')
              }
            >
              {state === 'ACCEPTED' ? '✓ Acceptée' : 'Accepter'}
            </button>
            <button
              type="button"
              onClick={() => setShowReject(true)}
              disabled={pending}
              className="border border-line-2 bg-white px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-2 transition hover:border-cmred hover:text-cmred disabled:opacity-50"
            >
              Rejeter…
            </button>
          </div>
        )}
        {!canEdit && (
          <div className="flex-none text-[10.5px] uppercase tracking-[0.12em] text-ink-4">
            lecture seule
          </div>
        )}
      </div>

      {showReject && (
        <div className="border-t border-line bg-bgsoft px-5 py-3">
          <label className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-2">
            Motif du rejet (visible par l&apos;investisseur)
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. Document illisible aux pages 4-7, merci de re-scanner en 300 DPI minimum."
            className="w-full border border-line-2 bg-white px-3 py-2 text-[12.5px] text-ink focus:border-cmred focus:outline-none focus:ring-1 focus:ring-cmred"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowReject(false); setError(null); }}
              disabled={pending}
              className="border border-line-2 bg-white px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={reject}
              disabled={pending}
              className="bg-cmred px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.12em] text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Envoi…' : 'Confirmer le rejet'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function romanIndex(n: number): string {
  return ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'][n] ?? String(n);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}
