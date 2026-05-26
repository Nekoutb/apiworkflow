'use client';

import { useActionState, useRef, useEffect, useState } from 'react';
import {
  registerArrivedDocument,
  type RegisterArriveeState,
} from '@/lib/actions/courrier-arrivee';

const initial: RegisterArriveeState = {};

const NATURES = [
  { value: 'AGREMENT_REQUEST',       label: "Demande d'agrément (Ord. 2025/002)" },
  { value: 'GENERAL_CORRESPONDENCE', label: 'Correspondance générale' },
  { value: 'OFFICIAL_NOTIFICATION',  label: "Notification officielle d'une administration" },
  { value: 'PARTNERSHIP_PROPOSAL',   label: 'Proposition de partenariat' },
  { value: 'COMPLAINT',              label: 'Réclamation' },
  { value: 'REPORT',                 label: 'Rapport' },
  { value: 'OTHER',                  label: 'Autre' },
];

const CHANNELS = [
  { value: 'COURRIER_PHYSICAL', label: 'Physique · scanné au siège' },
  { value: 'ONLINE',            label: 'En ligne (transcription manuelle)' },
  { value: 'ANTENNE',           label: "Reçu via une antenne régionale" },
];

const SENDER_TYPES = [
  'Investisseur',
  'Particulier',
  'Administration',
  'Entreprise',
  'Autre',
];

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerArrivedDocument, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string>('');

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setFileName('');
    }
  }, [state.ok]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {state.error && (
        <div className="border border-cmred bg-cmred-50 px-4 py-3 text-[13px] font-medium text-cmred">
          {state.error}
        </div>
      )}
      {state.ok && state.reference && (
        <div className="border border-cmgreen-800 bg-cmgreen-50 px-4 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
            ✓ Document enregistré · accusé envoyé
          </div>
          <div className="mt-1 font-mono text-[15px] font-bold text-cmgreen-900">
            {state.reference}
          </div>
        </div>
      )}

      {/* Sender block */}
      <fieldset className="border border-line bg-white">
        <legend className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
          Émetteur
        </legend>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Nom complet" name="senderName" error={state.fieldErrors?.senderName}>
            <input
              name="senderName"
              required
              maxLength={120}
              placeholder="ex. Aïcha Bouba"
              className={inputCls}
            />
          </Field>
          <Field label="Email" name="senderEmail" error={state.fieldErrors?.senderEmail}>
            <input
              type="email"
              name="senderEmail"
              required
              placeholder="ex. contact@example.cm"
              className={inputCls}
            />
          </Field>
          <Field label="Organisation / Société (optionnel)" name="senderOrganization">
            <input name="senderOrganization" maxLength={160} placeholder="ex. Cameroun Solar Power SA" className={inputCls} />
          </Field>
          <Field label="Téléphone (optionnel)" name="senderPhone">
            <input name="senderPhone" maxLength={40} placeholder="ex. +237 6 55 44 33 22" className={inputCls} />
          </Field>
          <Field label="Type d'émetteur" name="senderType">
            <select name="senderType" defaultValue="Investisseur" className={selectCls}>
              {SENDER_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
      </fieldset>

      {/* Document block */}
      <fieldset className="border border-line bg-white">
        <legend className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
          Document
        </legend>
        <div className="grid gap-4 p-5 md:grid-cols-2">
          <Field label="Canal de réception" name="sourceChannel" error={state.fieldErrors?.sourceChannel}>
            <select name="sourceChannel" required defaultValue="COURRIER_PHYSICAL" className={selectCls}>
              {CHANNELS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Nature du document" name="nature" error={state.fieldErrors?.nature}>
            <select name="nature" required defaultValue="AGREMENT_REQUEST" className={selectCls}>
              {NATURES.map((n) => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Objet" name="subject" error={state.fieldErrors?.subject}>
              <input
                name="subject"
                required
                minLength={5}
                maxLength={400}
                placeholder="ex. Demande d'agrément · projet de centrale solaire 50 MW"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Pièce jointe (PDF ou image · max 10 Mo)" name="document" error={state.fieldErrors?.document}>
              <label className="flex items-center gap-3 border border-dashed border-line-2 bg-bgsoft px-4 py-4 hover:border-cmgreen-800">
                <span className="bg-obsidian px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-500">
                  Choisir un fichier
                </span>
                <span className="flex-1 truncate text-[12.5px] italic text-ink-3">
                  {fileName || 'Aucun fichier sélectionné'}
                </span>
                <input
                  name="document"
                  type="file"
                  required
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                  className="hidden"
                />
              </label>
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Note interne (optionnel · visible uniquement par le DG et le Bureau Arrivée)" name="notes">
              <textarea
                name="notes"
                rows={3}
                maxLength={2000}
                placeholder="ex. Reçu en 2 exemplaires originaux signés."
                className={inputCls}
              />
            </Field>
          </div>
        </div>
      </fieldset>

      <div className="flex items-center justify-between border-t border-line pt-5">
        <p className="serif text-[12.5px] italic text-ink-3">
          ⓘ L&apos;émetteur recevra un accusé de réception par email avec la
          référence officielle. Le délai légal court à compter de cet instant.
        </p>
        <button
          type="submit"
          disabled={pending}
          className="bg-cmgreen-800 px-6 py-3 text-[12.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
        >
          {pending ? 'Enregistrement…' : 'Enregistrer & accuser réception'}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800';
const selectCls =
  'w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800';

function Field({
  label,
  name,
  children,
  error,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
      >
        {label}
      </label>
      {children}
      {error && (
        <div className="mt-1 text-[11.5px] font-medium text-cmred">{error}</div>
      )}
    </div>
  );
}
