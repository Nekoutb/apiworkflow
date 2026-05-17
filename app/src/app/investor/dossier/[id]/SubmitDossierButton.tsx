'use client';

import { submitDossierAction } from '@/lib/actions/dossier-actions';

export function SubmitDossierButton({ dossierId }: { dossierId: string }) {
  return (
    <form action={submitDossierAction}>
      <input type="hidden" name="dossierId" value={dossierId} />
      <button type="submit" className="btn-primary">
        Soumettre le dossier au Guichet Unique →
      </button>
    </form>
  );
}
