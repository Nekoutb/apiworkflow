'use client';

import { useActionState } from 'react';
import { createDraftConventionAction } from '@/lib/actions/convention';
import {
  initialCreateConventionState,
  PROJECT_SECTORS,
  PROJECT_TYPES,
  type CreateConventionState,
} from '@/lib/convention-config';
import { SIGNUP_REGIONS } from '@/lib/signup-config';

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState<CreateConventionState, FormData>(
    createDraftConventionAction,
    initialCreateConventionState,
  );

  const v = state.status === 'error' ? state.values ?? {} : {};

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' && (
        <div className="border border-cmred bg-cmred-50 px-4 py-3 text-[13px] font-medium text-cmred">
          {state.error}
        </div>
      )}

      <Field
        id="projectName"
        label="Nom du projet *"
        placeholder="Ex. Centrale solaire 50 MW · Maroua"
        required
        defaultValue={v.projectName}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          id="sector"
          label="Secteur d'activité *"
          required
          defaultValue={v.sector ?? ''}
          placeholderOption="— Sélectionner —"
        >
          {PROJECT_SECTORS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>

        <Select
          id="projectType"
          label="Type de projet *"
          required
          defaultValue={v.projectType ?? ''}
          placeholderOption="— Sélectionner —"
        >
          {PROJECT_TYPES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </Select>
      </div>

      <Select
        id="region"
        label="Région d'implantation *"
        required
        defaultValue={v.region ?? ''}
        placeholderOption="— Sélectionner —"
      >
        {SIGNUP_REGIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </Select>

      <div className="grid gap-5 sm:grid-cols-2">
        <FcfaField
          id="investmentFcfa"
          label="Montant d'investissement (FCFA) *"
          required
          defaultValue={v.investmentFcfa}
        />
        <Field
          id="jobsPlanned"
          label="Emplois prévus (optionnel)"
          type="number"
          placeholder="ex. 187"
          defaultValue={v.jobsPlanned}
          inputMode="numeric"
          min={0}
        />
      </div>

      <div className="border-l-4 border-gold-600 bg-gold-50/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
        <strong className="block text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
          Étape suivante
        </strong>
        Après l&apos;enregistrement de votre projet, vous serez invité à téléverser les 6 pièces
        obligatoires (Ordonnance n° 2025/002, Art. 6) puis à soumettre le dossier au Secrétariat.
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-cmgreen-800 py-3.5 text-[13px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
      >
        {pending ? 'Création en cours…' : 'Enregistrer le projet & continuer →'}
      </button>
    </form>
  );
}

function Field({
  id, label, type = 'text', placeholder, required, defaultValue, hint, inputMode, min,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  inputMode?: 'numeric' | 'text';
  min?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        inputMode={inputMode}
        min={min}
        className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
      />
      {hint && <div className="mt-1.5 text-[11.5px] italic text-ink-3">{hint}</div>}
    </div>
  );
}

function FcfaField({
  id, label, required, defaultValue,
}: { id: string; label: string; required?: boolean; defaultValue?: string }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
        {label}
      </label>
      <div className="flex items-stretch border border-line-2 bg-white focus-within:border-cmgreen-800 focus-within:ring-1 focus-within:ring-cmgreen-800">
        <input
          id={id}
          name={id}
          type="number"
          required={required}
          placeholder="500000000"
          min={0}
          step={1}
          defaultValue={defaultValue}
          className="w-full bg-transparent px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:outline-none"
        />
        <span className="flex items-center border-l border-line bg-bgsoft px-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
          FCFA
        </span>
      </div>
      <div className="mt-1.5 text-[11.5px] italic text-ink-3">
        Catégorie&nbsp;: A &lt; 1 Md · B 1–5 Md · C &gt; 5 Md (Art. 30 & 31).
      </div>
    </div>
  );
}

function Select({
  id, label, required, defaultValue, placeholderOption, children,
}: {
  id: string;
  label: string;
  required?: boolean;
  defaultValue?: string;
  placeholderOption?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
        {label}
      </label>
      <select
        id={id}
        name={id}
        required={required}
        defaultValue={defaultValue}
        className="w-full appearance-none border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
      >
        {placeholderOption !== undefined && (
          <option value="" disabled>{placeholderOption}</option>
        )}
        {children}
      </select>
    </div>
  );
}
