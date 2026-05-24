'use client';

import { useRef, useState, useTransition } from 'react';
import {
  removeDocumentAction,
  uploadDocumentAction,
} from '@/lib/actions/convention';
import { ACCEPTED_MIME, MAX_UPLOAD_BYTES, type RequiredDocSlot } from '@/lib/required-documents';
import { initialUploadDocState, type UploadDocState } from '@/lib/convention-config';

export type SlotDocument = {
  id: string;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;        // ISO
  verification: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  rejectionReason: string | null;
  stub: boolean;             // true when storage isn't real (no Blob token)
};

export function UploadDocSlot({
  index,
  slot,
  conventionId,
  document,
  blobConfigured,
}: {
  index: number;
  slot: RequiredDocSlot;
  conventionId: string;
  document: SlotDocument | null;
  blobConfigured: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [state, setState] = useState<UploadDocState>(initialUploadDocState);
  const [pending, startTransition] = useTransition();

  const onPick = () => inputRef.current?.click();

  const onFile = (file: File | null) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setState({ status: 'error', error: 'Fichier > 10 Mo.' });
      return;
    }
    if (file.type && !ACCEPTED_MIME.includes(file.type as 'application/pdf')) {
      setState({ status: 'error', error: 'PDF uniquement.' });
      return;
    }
    const fd = new FormData();
    fd.set('conventionId', conventionId);
    fd.set('kind', slot.kind);
    fd.set('file', file);
    startTransition(async () => {
      const next = await uploadDocumentAction(state, fd);
      setState(next);
    });
  };

  const onRemove = () => {
    if (!document) return;
    const fd = new FormData();
    fd.set('documentId', document.id);
    startTransition(async () => {
      await removeDocumentAction(fd);
      setState(initialUploadDocState);
    });
  };

  const uploaded = document !== null;
  const rejected = uploaded && document!.verification === 'REJECTED';

  return (
    <li
      onDragOver={(e) => {
        if (uploaded) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (uploaded) return;
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={
        'relative flex items-center gap-4 border-b border-line px-6 py-4 last:border-b-0 transition ' +
        (dragOver ? 'bg-cmgreen-50' : uploaded ? 'bg-white' : 'bg-white hover:bg-bgsoft')
      }
    >
      <div
        className={
          'flex h-10 w-10 flex-none items-center justify-center font-display text-[14px] font-bold italic ' +
          (uploaded
            ? 'border border-cmgreen-700 bg-cmgreen-50 text-cmgreen-800'
            : 'border border-line-2 bg-bgsoft text-ink-3')
        }
      >
        {romanIndex(index)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-ink">
          {slot.title}
          <span className="ml-2 font-mono text-[10.5px] font-normal text-ink-3">{slot.article}</span>
        </div>
        {!uploaded && (
          <div className="text-[11.5px] italic text-ink-3">{slot.description}</div>
        )}
        {uploaded && (
          <div className="mt-0.5 truncate text-[11.5px] text-ink-3">
            <span className="font-mono">{document!.fileName}</span>
            <span className="mx-1.5 text-ink-4">·</span>
            <span>{formatSize(document!.sizeBytes)}</span>
            <span className="mx-1.5 text-ink-4">·</span>
            <span>Téléversée {formatRelative(document!.uploadedAt)}</span>
            {document!.stub && (
              <span className="ml-2 inline-block border border-gold-600 px-1 py-0 text-[9.5px] font-bold uppercase tracking-[0.1em] text-gold-700">
                stockage local
              </span>
            )}
          </div>
        )}
        {rejected && document!.rejectionReason && (
          <div className="mt-1 text-[11.5px] italic text-cmred">
            Rejetée · « {document!.rejectionReason} »
          </div>
        )}
        {state.status === 'error' && (
          <div className="mt-1 text-[11.5px] italic text-cmred">{state.error}</div>
        )}
      </div>

      <div className="flex flex-none items-center gap-2">
        {uploaded ? (
          <>
            <button
              type="button"
              onClick={onPick}
              disabled={pending}
              className="border border-line-2 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
            >
              Remplacer
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={pending}
              title="Retirer la pièce"
              className="border border-line-2 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3 transition hover:border-cmred hover:text-cmred disabled:opacity-50"
            >
              Retirer
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onPick}
            disabled={pending}
            className={
              'px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] transition disabled:opacity-50 ' +
              (rejected
                ? 'bg-cmred text-white hover:opacity-90'
                : 'bg-gold-600 text-obsidian hover:bg-gold-500')
            }
          >
            {pending ? 'Envoi…' : rejected ? 'Re-téléverser' : 'Téléverser'}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {!blobConfigured && !uploaded && (
        <div className="absolute right-3 top-2 text-[9.5px] font-bold uppercase tracking-[0.1em] text-gold-700">
          mode stub
        </div>
      )}
    </li>
  );
}

function romanIndex(n: number): string {
  const map: Record<number, string> = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v', 6: 'vi' };
  return map[n] ?? String(n);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}
