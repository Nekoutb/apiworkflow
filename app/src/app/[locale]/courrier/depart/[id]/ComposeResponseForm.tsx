'use client';

import { useActionState, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { sendResponse, type SendResponseState } from '@/lib/actions/courrier-depart';

const initial: SendResponseState = {};

const DEFAULT_COVER_LETTER =
  `Madame, Monsieur,

Faisant suite à votre courrier référencé ci-dessus, je vous prie de bien vouloir trouver en pièce jointe la décision officielle de l'Agence de Promotion des Investissements relative à votre demande.

Pour toute question complémentaire, merci de citer la référence du dossier dans votre prochaine correspondance.

Je vous prie d'agréer, Madame, Monsieur, l'expression de ma considération distinguée.

Le Directeur Général
Agence de Promotion des Investissements`;

export function ComposeResponseForm({
  documentId,
  defaultRecipientEmail,
  defaultRecipientName,
  reference,
  originalSubject,
}: {
  documentId: string;
  defaultRecipientEmail: string;
  defaultRecipientName: string;
  reference: string;
  originalSubject: string;
}) {
  const [state, formAction, pending] = useActionState(sendResponse, initial);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState('');
  const [cover, setCover] = useState(DEFAULT_COVER_LETTER);

  // After successful send, kick the user back to the parapheur
  useEffect(() => {
    if (state.ok) {
      const t = setTimeout(() => router.push('/courrier/depart'), 1800);
      return () => clearTimeout(t);
    }
  }, [state.ok, router]);

  return (
    <div className="lg:sticky lg:top-6 lg:self-start">
      <div className="border border-line bg-white">
        <div className="border-b border-line bg-bgsoft px-4 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            ✉️ Réponse officielle
          </div>
          <h2 className="serif mt-0.5 text-[18px] font-semibold text-ink">
            Composer & expédier
          </h2>
          <p className="serif mt-1 text-[12px] italic text-ink-3">
            Joignez le PDF signé du DG et le mot d&apos;accompagnement.
            L&apos;email est envoyé à <strong className="not-italic font-mono">{defaultRecipientEmail}</strong>.
          </p>
        </div>

        <form ref={formRef} action={formAction} className="space-y-5 p-5">
          {state.error && (
            <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
              {state.error}
            </div>
          )}
          {state.ok && (
            <div className="border border-cmgreen-800 bg-cmgreen-50 px-3.5 py-3">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
                ✓ Réponse expédiée
              </div>
              <div className="mt-1 font-mono text-[13px] font-bold text-cmgreen-900">
                {state.reference}
              </div>
              <p className="serif mt-1 text-[11.5px] italic text-cmgreen-900/80">
                Redirection vers le parapheur…
              </p>
            </div>
          )}

          <input type="hidden" name="documentId" value={documentId} />

          {/* Recipient override */}
          <Field
            label="Adresse de réponse"
            name="recipientOverrideEmail"
            error={state.fieldErrors?.recipientOverrideEmail}
            hint="Par défaut, l'email enregistré à l'arrivée. Vous pouvez le corriger."
          >
            <input
              type="email"
              name="recipientOverrideEmail"
              defaultValue={defaultRecipientEmail}
              required
              className={inputCls}
            />
          </Field>

          {/* Cover letter */}
          <Field
            label="Lettre d'accompagnement (corps de l'email)"
            name="coverLetter"
            error={state.fieldErrors?.coverLetter}
            hint={`${cover.length} caractères · le PDF signé sera mentionné en pièce jointe`}
          >
            <textarea
              name="coverLetter"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              required
              rows={11}
              maxLength={4000}
              className={inputCls + ' font-serif text-[13px] leading-[1.55]'}
            />
          </Field>

          {/* Signed PDF */}
          <Field
            label="Réponse signée du DG (PDF · max 10 Mo)"
            name="responseFile"
            error={state.fieldErrors?.responseFile}
          >
            <label className="flex items-center gap-3 border border-dashed border-line-2 bg-bgsoft px-4 py-3 hover:border-cmgreen-800">
              <span className="bg-obsidian px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-500">
                Choisir
              </span>
              <span className="flex-1 truncate text-[12px] italic text-ink-3">
                {fileName || 'Aucun fichier sélectionné'}
              </span>
              <input
                name="responseFile"
                type="file"
                required
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                className="hidden"
              />
            </label>
          </Field>

          {/* Email preview snippet */}
          <div className="border border-line bg-bgsoft p-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
              Aperçu objet de l&apos;email
            </div>
            <div className="serif mt-1 text-[12.5px] italic text-ink-2">
              Réponse · <span className="font-mono not-italic text-[11.5px]">{reference}</span>
            </div>
            <div className="mt-1 text-[11px] text-ink-4">
              Réf. originale&nbsp;: « {originalSubject} »
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || state.ok}
            className="w-full bg-cmgreen-800 px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
          >
            {pending ? 'Expédition…' : state.ok ? 'Expédié ✓' : "Expédier la réponse →"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800';

function Field({
  label,
  name,
  children,
  error,
  hint,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
        {label}
      </label>
      {children}
      {hint && !error && <div className="mt-1 text-[10.5px] italic text-ink-4">{hint}</div>}
      {error && <div className="mt-1 text-[11.5px] font-medium text-cmred">{error}</div>}
    </div>
  );
}
