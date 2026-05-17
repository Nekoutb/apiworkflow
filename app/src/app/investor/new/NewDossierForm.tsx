'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createDossierAction, type CreateDossierState } from '@/lib/actions/dossier-actions';

const initialState: CreateDossierState = {};

const SECTORS = [
  { value: 'AGRICULTURE',  label: 'Agriculture, élevage et pêche' },
  { value: 'INDUSTRIE',    label: 'Industrie lourde, automobile, manufacturière' },
  { value: 'ENERGIE',      label: 'Eau et énergie' },
  { value: 'EDUCATION',    label: 'Éducation et santé' },
  { value: 'TRANSPORT',    label: 'Transport aérien, ferroviaire, maritime' },
  { value: 'TOURISME',     label: 'Tourisme et loisirs' },
  { value: 'DISTRIBUTION', label: 'Infrastructures de grande distribution' },
  { value: 'NUMERIQUE',    label: 'Infrastructures stockage / traitement de données' },
];

export function NewDossierForm({ zdps }: { zdps: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createDossierAction, initialState);

  // On successful creation, redirect to the dossier detail page (where docs are uploaded)
  useEffect(() => {
    if (state.ok?.dossierId) {
      router.push(`/investor/dossier/${state.ok.dossierId}`);
    }
  }, [state.ok, router]);

  return (
    <form action={formAction} className="mt-6 space-y-5">
      {state.formError && (
        <div className="rounded-lg border border-danger bg-danger-bg p-3 text-sm text-danger">
          {state.formError}
        </div>
      )}

      <Field label="Secteur d'activité" name="sector" required errors={state.errors?.sector}>
        <select
          id="sector"
          name="sector"
          required
          className="mt-1.5 w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-sm focus:border-cmgreen-700 focus:outline-none focus:ring-2 focus:ring-cmgreen-700/15"
        >
          <option value="">Sélectionner…</option>
          {SECTORS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Field>

      <Field label="Type de projet" name="projectType" required errors={state.errors?.projectType}>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-white p-3 text-sm hover:border-cmgreen-700 has-[:checked]:border-cmgreen-700 has-[:checked]:bg-cmgreen-50">
            <input type="radio" name="projectType" value="NEW" required />
            <div>
              <div className="font-semibold">Projet nouveau</div>
              <div className="text-xs text-ink-muted">Art. 7 — entreprise nouvelle ou activité distincte</div>
            </div>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-strong bg-white p-3 text-sm hover:border-cmgreen-700 has-[:checked]:border-cmgreen-700 has-[:checked]:bg-cmgreen-50">
            <input type="radio" name="projectType" value="EXTENSION" required />
            <div>
              <div className="font-semibold">Projet d&apos;extension</div>
              <div className="text-xs text-ink-muted">Art. 8 — extension d&apos;une activité existante</div>
            </div>
          </label>
        </div>
      </Field>

      <Field label="Montant total de l'investissement (FCFA)" name="amountFcfa" required errors={state.errors?.amountFcfa}>
        <input
          id="amountFcfa"
          name="amountFcfa"
          type="number"
          min="1"
          step="1"
          required
          placeholder="800000000"
          className="mt-1.5 w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-sm focus:border-cmgreen-700 focus:outline-none focus:ring-2 focus:ring-cmgreen-700/15"
        />
        <p className="mt-1 text-xs text-ink-muted">
          Catégorie A &lt; 1 Md · Catégorie B 1–5 Md · Catégorie C &gt; 5 Md (Art. 11)
        </p>
      </Field>

      <Field label="Durée de la phase d'installation (mois)" name="installationMonths" errors={state.errors?.installationMonths}>
        <input
          id="installationMonths"
          name="installationMonths"
          type="number"
          min="1"
          max="60"
          defaultValue={60}
          className="mt-1.5 w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-sm focus:border-cmgreen-700 focus:outline-none focus:ring-2 focus:ring-cmgreen-700/15"
        />
        <p className="mt-1 text-xs text-ink-muted">Plafond légal : 60 mois (Art. 10).</p>
      </Field>

      <div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-bg-page p-3 text-sm hover:border-cmgreen-700 has-[:checked]:border-cmgreen-700 has-[:checked]:bg-cmgreen-50">
          <input type="checkbox" name="isZdp" id="isZdp" />
          <span>
            <span className="font-semibold">Implantation en Zone de Développement Prioritaire (ZDP)</span>
            <span className="block text-xs text-ink-muted">Art. 12 — bénéficie d&apos;incitations renforcées (crédit d&apos;impôt majoré, perfectionnement actif, etc.)</span>
          </span>
        </label>
        <select
          name="zdpLocality"
          className="mt-2 w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-sm focus:border-cmgreen-700 focus:outline-none focus:ring-2 focus:ring-cmgreen-700/15"
          defaultValue=""
        >
          <option value="">Localité ZDP (si applicable)…</option>
          {zdps.map((z) => (
            <option key={z.id} value={z.name}>{z.name}</option>
          ))}
        </select>
      </div>

      <Field label="Objet du projet" name="objet" required errors={state.errors?.objet}>
        <textarea
          id="objet"
          name="objet"
          rows={5}
          required
          minLength={20}
          placeholder="Ex. : Création d'une unité agro-industrielle de transformation de manioc en farine et amidon, située à Garoua (Région du Nord). Capacité visée : 12 000 tonnes/an."
          className="mt-1.5 w-full rounded-lg border border-border-strong bg-white px-3 py-2.5 text-sm focus:border-cmgreen-700 focus:outline-none focus:ring-2 focus:ring-cmgreen-700/15"
        />
      </Field>

      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
        {pending ? 'Création en cours…' : 'Continuer vers le téléversement des pièces →'}
      </button>
    </form>
  );
}

function Field({
  label, name, required, errors, children,
}: {
  label: string; name: string; required?: boolean; errors?: string[]; children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold uppercase tracking-wider text-ink">
        {label}{required ? <span className="text-cmred"> *</span> : null}
      </label>
      {children}
      {errors?.length ? <p className="mt-1 text-xs text-danger">{errors[0]}</p> : null}
    </div>
  );
}
