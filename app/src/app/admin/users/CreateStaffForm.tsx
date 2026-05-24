'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { createStaffAction } from '@/lib/actions/users';
import { initialCreateStaffState, type CreateStaffState } from '@/lib/users-config';
import { ROLE_LABELS_FR, STAFF_ROLES } from '@/lib/roles';

export function CreateStaffForm() {
  const [state, formAction, pending] = useActionState<CreateStaffState, FormData>(
    createStaffAction,
    initialCreateStaffState,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const [toast, setToast] = useState<{ email: string; mode: 'sent' | 'logged' | 'error' } | null>(null);

  useEffect(() => {
    if (state.status === 'success') {
      setToast({ email: state.email, mode: state.emailMode });
      formRef.current?.reset();
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const values = state.status === 'error' ? state.values : undefined;

  return (
    <div className="relative">
      {toast && (
        <div
          role="status"
          className="pointer-events-none absolute -top-2 right-0 z-10 flex max-w-md items-start gap-3 border border-cmgreen-700 bg-white px-4 py-3 shadow-lg"
        >
          <div className="flex h-6 w-6 flex-none items-center justify-center bg-cmgreen-800 text-[12px] font-bold text-white">
            ✓
          </div>
          <div className="text-[13px] leading-tight text-ink">
            <div className="font-semibold">Compte créé</div>
            <div className="mt-0.5 text-ink-2">
              {toast.mode === 'sent' && <>Email de bienvenue envoyé à <strong>{toast.email}</strong></>}
              {toast.mode === 'logged' && <>Compte actif · email simulé (mode dev) pour <strong>{toast.email}</strong></>}
              {toast.mode === 'error' && <>Compte créé · l'envoi de l'email a échoué pour <strong>{toast.email}</strong></>}
            </div>
          </div>
        </div>
      )}

      <form ref={formRef} action={formAction} className="border border-line bg-white p-6">
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
          ⚜ Nouveau compte
        </div>
        <h3 className="serif text-[19px] font-bold text-ink">Créer un personnel</h3>

        {state.status === 'error' && (
          <div className="mt-4 border border-cmred bg-cmred-50 px-3 py-2 text-[12.5px] font-medium text-cmred">
            {state.error}
          </div>
        )}

        <div className="mt-5 space-y-4">
          <Field
            id="name"
            label="Nom complet"
            type="text"
            placeholder="Prénom NOM"
            defaultValue={values?.name}
            required
          />

          <Field
            id="email"
            label={<>Adresse email <span className="text-cmred">*</span></>}
            type="email"
            placeholder="p.nom@api.cm"
            defaultValue={values?.email}
            required
            hint="Un email contenant les identifiants temporaires (admin / admin) sera envoyé."
          />

          <div>
            <label
              htmlFor="role"
              className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
            >
              Rôle <span className="text-cmred">*</span>
            </label>
            <select
              id="role"
              name="role"
              required
              defaultValue={values?.role ?? ''}
              className="w-full appearance-none border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
            >
              <option value="" disabled>
                — Sélectionner un rôle —
              </option>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_FR[r]}
                </option>
              ))}
            </select>
            <div className="mt-1.5 text-[11.5px] italic text-ink-3">
              Le rôle détermine la corbeille de l'utilisateur et les actions qui lui sont autorisées.
            </div>
          </div>

          <Field
            id="phone"
            label="Téléphone (optionnel)"
            type="tel"
            placeholder="+237 6 XX XX XX XX"
            defaultValue={values?.phone}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="mt-6 w-full bg-cmgreen-800 py-3 text-[12.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
        >
          {pending ? 'Création…' : "Créer le compte & envoyer l'email →"}
        </button>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  placeholder,
  required,
  defaultValue,
  hint,
}: {
  id: string;
  label: React.ReactNode;
  type: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
      />
      {hint && <div className="mt-1.5 text-[11.5px] italic text-ink-3">{hint}</div>}
    </div>
  );
}
