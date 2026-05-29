'use client';

import { useState, useActionState, useRef, useEffect } from 'react';
import { createStaff, type StaffActionState } from '@/lib/actions/users';
import { RolePicker } from './RolePicker';

type Antenne = { id: string; name: string; region: string; active: boolean };

const initial: StaffActionState = {};

export function CreateUserForm({ antennes }: { antennes: Antenne[] }) {
  const [state, formAction, pending] = useActionState(createStaff, initial);
  const [role, setRole] = useState<string>('');
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form on successful submission so the next entry starts fresh
  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setRole('');
    }
  }, [state.ok]);

  const showAntenne = role === 'CHEF_ANTENNE';
  const activeAntennes = antennes.filter((a) => a.active);

  return (
    <details className="group border border-line bg-white">
      <summary className="cursor-pointer list-none border-b border-line bg-bgsoft px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.16em] text-ink-2 transition hover:text-ink">
        <span className="inline-block align-middle">
          <span className="mr-2 inline-block transition group-open:rotate-90">▶</span>
          Créer un compte personnel
        </span>
      </summary>

      <form ref={formRef} action={formAction} className="grid gap-4 px-5 py-5 md:grid-cols-2">
        {state.error && (
          <div className="md:col-span-2 border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="md:col-span-2 border border-cmgreen-800 bg-cmgreen-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmgreen-900">
            ✓ Compte créé. Mot de passe initial&nbsp;: <code className="font-mono">admin</code>.
          </div>
        )}

        {/* Short identifier */}
        <div>
          <label htmlFor="cuf-shortName" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
            Identifiant court
          </label>
          <div className="flex items-stretch border border-line-2 bg-white focus-within:border-cmgreen-800 focus-within:ring-1 focus-within:ring-cmgreen-800">
            <input
              id="cuf-shortName"
              name="shortName"
              type="text"
              required
              autoComplete="off"
              placeholder="ex. m.etoundi"
              className="flex-1 bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:outline-none"
            />
            <span className="flex items-center border-l border-line-2 bg-bgsoft px-3 font-mono text-[12.5px] text-ink-3">
              @api.cm
            </span>
          </div>
          {state.fieldErrors?.shortName && (
            <div className="mt-1 text-[11.5px] font-medium text-cmred">{state.fieldErrors.shortName}</div>
          )}
        </div>

        {/* Full name */}
        <div>
          <label htmlFor="cuf-fullName" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
            Nom complet
          </label>
          <input
            id="cuf-fullName"
            name="fullName"
            type="text"
            required
            placeholder="ex. Marie Etoundi"
            className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13.5px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
          />
          {state.fieldErrors?.fullName && (
            <div className="mt-1 text-[11.5px] font-medium text-cmred">{state.fieldErrors.fullName}</div>
          )}
        </div>

        {/* Role (grouped) */}
        <div className="md:col-span-2">
          <label htmlFor="cuf-role" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
            Rôle (organigramme · 37 rôles)
          </label>
          <RolePicker
            id="cuf-role"
            name="role"
            required
            onValueChange={(v) => setRole(v)}
          />
          {state.fieldErrors?.role && (
            <div className="mt-1 text-[11.5px] font-medium text-cmred">{state.fieldErrors.role}</div>
          )}
        </div>

        {/* Antenne (only for CHEF_ANTENNE) */}
        {showAntenne && (
          <div className="md:col-span-2">
            <label htmlFor="cuf-antenne" className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
              Antenne régionale
            </label>
            {activeAntennes.length === 0 ? (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] text-cmred">
                Aucune antenne active. Créez-en une d&apos;abord ci-dessous.
              </div>
            ) : (
              <select
                id="cuf-antenne"
                name="antenneId"
                required
                className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
              >
                <option value="">— Sélectionner une antenne —</option>
                {activeAntennes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.region}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <div className="md:col-span-2 flex items-center justify-between border-t border-line pt-4">
          <p className="serif text-[11.5px] italic text-ink-3">
            Mot de passe initial&nbsp;: <code className="font-mono not-italic">admin</code> · l&apos;agent
            le changera plus tard (B26 · onboarding).
          </p>
          <button
            type="submit"
            disabled={pending}
            className="bg-blue-700 px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      </form>
    </details>
  );
}
