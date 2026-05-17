'use client';

import { useActionState, useRef } from 'react';
import { Paperclip, RotateCcw } from 'lucide-react';
import { uploadDocAction, type UploadDocState } from '@/lib/actions/dossier-actions';

const initialState: UploadDocState = {};

export function UploadDocForm({
  dossierId, kind, replace,
}: { dossierId: string; kind: string; replace?: boolean }) {
  const [state, formAction, pending] = useActionState(uploadDocAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onFilePicked() {
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="dossierId" value={dossierId} />
      <input type="hidden" name="kind" value={kind} />
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        onChange={onFilePicked}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
          replace
            ? 'border border-warning bg-warning-bg text-warning hover:bg-warning hover:text-white'
            : 'bg-cmgreen-700 text-white hover:bg-cmgreen-800'
        }`}
      >
        {replace ? <RotateCcw className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
        {pending ? 'Envoi…' : replace ? 'Remplacer' : 'Téléverser'}
      </button>
      {state.formError && <span className="text-xs text-danger">{state.formError}</span>}
    </form>
  );
}
