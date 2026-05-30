'use client';

import { useActionState, useRef, useEffect, useState, useTransition } from 'react';
import {
  registerArrivedDocument,
  type RegisterArriveeState,
} from '@/lib/actions/courrier-arrivee';
import {
  analyzeUploadedDocument,
  type AnalyzedDocument,
} from '@/lib/actions/analyze-document';

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

type AiPanelState =
  | { status: 'idle' }
  | { status: 'analyzing'; fileName: string }
  | { status: 'ok'; data: AnalyzedDocument; mode: 'live' | 'stub'; fileName: string }
  | { status: 'error'; error: string };

export function RegisterForm({ aiEnabled }: { aiEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(registerArrivedDocument, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [ai, setAi] = useState<AiPanelState>({ status: 'idle' });
  const [analyzing, startAnalyzing] = useTransition();
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  // Field values (controlled — so the AI can fill them)
  const [v, setV] = useState({
    senderName: '',
    senderEmail: '',
    senderOrganization: '',
    senderPhone: '',
    senderType: 'Investisseur',
    subject: '',
    nature: 'AGREMENT_REQUEST',
  });

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setFileName('');
      setAi({ status: 'idle' });
      setAiFilledFields(new Set());
      setV({
        senderName: '',
        senderEmail: '',
        senderOrganization: '',
        senderPhone: '',
        senderType: 'Investisseur',
        subject: '',
        nature: 'AGREMENT_REQUEST',
      });
    }
  }, [state.ok]);

  function onFileChange(file: File | null) {
    setFileName(file?.name ?? '');
    if (!file) {
      setAi({ status: 'idle' });
      return;
    }
    setAi({ status: 'analyzing', fileName: file.name });

    startAnalyzing(async () => {
      const fd = new FormData();
      fd.append('document', file);
      const result = await analyzeUploadedDocument(fd);

      if (!result.ok) {
        setAi({ status: 'error', error: result.error });
        return;
      }

      // Auto-fill only the fields the model returned a value for AND that
      // the user hasn't already typed into manually (preserves user edits)
      setV((cur) => {
        const next = { ...cur };
        const filled = new Set<string>(aiFilledFields);
        const fields: Array<keyof typeof cur> = [
          'senderName',
          'senderEmail',
          'senderOrganization',
          'senderPhone',
          'senderType',
          'subject',
          'nature',
        ];
        for (const k of fields) {
          const aiVal = (result.data as Record<string, unknown>)[k];
          // Only fill empty fields or ones we (the AI) filled previously
          if (typeof aiVal === 'string' && aiVal.trim() && (cur[k] === '' || filled.has(k))) {
            next[k] = aiVal as typeof cur[typeof k];
            filled.add(k);
          }
        }
        setAiFilledFields(filled);
        return next;
      });

      setAi({ status: 'ok', data: result.data, mode: result.mode, fileName: file.name });
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.55fr_1fr]">
      {/* ====== Left: form ====== */}
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

        {/* File picker first — drives the AI panel */}
        <fieldset className="border border-line bg-white">
          <legend className="ml-3 bg-white px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            1. Document scanné
          </legend>
          <div className="p-5">
            <label className="flex items-center gap-3 border border-dashed border-line-2 bg-bgsoft px-4 py-4 hover:border-cmgreen-800">
              <span className="bg-obsidian px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-500">
                Choisir un fichier
              </span>
              <span className="flex-1 truncate text-[12.5px] italic text-ink-3">
                {fileName || 'Aucun fichier sélectionné · PDF ou image (≤ 10 Mo)'}
              </span>
              <input
                name="document"
                type="file"
                required
                accept="application/pdf,image/png,image/jpeg,image/webp"
                onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {state.fieldErrors?.document && (
              <div className="mt-1 text-[11.5px] font-medium text-cmred">
                {state.fieldErrors.document}
              </div>
            )}
            <p className="serif mt-2 text-[11.5px] italic text-ink-3">
              {aiEnabled
                ? "Dès le choix du fichier, l'IA lit le document et pré-remplit les champs ci-dessous. Vous pouvez tout corriger."
                : "Mode démo · l'analyse IA n'est pas active sur ce serveur. Saisie 100 % manuelle."}
            </p>
          </div>
        </fieldset>

        {/* Sender block */}
        <fieldset className="border border-line bg-white">
          <legend className="ml-3 bg-white px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            2. Émetteur
          </legend>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Nom complet" name="senderName" error={state.fieldErrors?.senderName} aiFilled={aiFilledFields.has('senderName')}>
              <input
                name="senderName"
                value={v.senderName}
                onChange={(e) => { setV({ ...v, senderName: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderName'); return n; }); }}
                required
                maxLength={120}
                placeholder="ex. Aïcha Bouba"
                className={inputCls}
              />
            </Field>
            <Field label="Email" name="senderEmail" error={state.fieldErrors?.senderEmail} aiFilled={aiFilledFields.has('senderEmail')}>
              <input
                type="email"
                name="senderEmail"
                value={v.senderEmail}
                onChange={(e) => { setV({ ...v, senderEmail: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderEmail'); return n; }); }}
                required
                placeholder="ex. contact@example.cm"
                className={inputCls}
              />
            </Field>
            <Field label="Organisation / Société" name="senderOrganization" aiFilled={aiFilledFields.has('senderOrganization')}>
              <input
                name="senderOrganization"
                value={v.senderOrganization}
                onChange={(e) => { setV({ ...v, senderOrganization: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderOrganization'); return n; }); }}
                maxLength={160}
                placeholder="ex. Cameroun Solar Power SA"
                className={inputCls}
              />
            </Field>
            <Field label="Téléphone" name="senderPhone" aiFilled={aiFilledFields.has('senderPhone')}>
              <input
                name="senderPhone"
                value={v.senderPhone}
                onChange={(e) => { setV({ ...v, senderPhone: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderPhone'); return n; }); }}
                maxLength={40}
                placeholder="ex. +237 6 55 44 33 22"
                className={inputCls}
              />
            </Field>
            <Field label="Type d'émetteur" name="senderType" aiFilled={aiFilledFields.has('senderType')}>
              <select
                name="senderType"
                value={v.senderType}
                onChange={(e) => { setV({ ...v, senderType: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderType'); return n; }); }}
                className={selectCls}
              >
                {SENDER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>

        {/* Document metadata block */}
        <fieldset className="border border-line bg-white">
          <legend className="ml-3 bg-white px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            3. Métadonnées
          </legend>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Canal de réception" name="sourceChannel" error={state.fieldErrors?.sourceChannel}>
              <select name="sourceChannel" required defaultValue="COURRIER_PHYSICAL" className={selectCls}>
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Nature du document" name="nature" error={state.fieldErrors?.nature} aiFilled={aiFilledFields.has('nature')}>
              <select
                name="nature"
                value={v.nature}
                onChange={(e) => { setV({ ...v, nature: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('nature'); return n; }); }}
                required
                className={selectCls}
              >
                {NATURES.map((n) => (
                  <option key={n.value} value={n.value}>{n.label}</option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label="Objet" name="subject" error={state.fieldErrors?.subject} aiFilled={aiFilledFields.has('subject')}>
                <input
                  name="subject"
                  value={v.subject}
                  onChange={(e) => { setV({ ...v, subject: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('subject'); return n; }); }}
                  required
                  minLength={5}
                  maxLength={400}
                  placeholder="ex. Demande d'agrément · projet de centrale solaire 50 MW"
                  className={inputCls}
                />
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
            ⓘ L&apos;émetteur recevra un accusé de réception par email. Le délai légal court à compter de cet instant.
          </p>
          <button
            type="submit"
            disabled={pending || analyzing}
            className="bg-blue-700 px-6 py-3 text-[12.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? 'Enregistrement…' : 'Enregistrer & accuser réception'}
          </button>
        </div>
      </form>

      {/* ====== Right: AI synopsis panel ====== */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <AiPanel state={ai} aiEnabled={aiEnabled} />
      </aside>
    </div>
  );
}

function AiPanel({ state, aiEnabled }: { state: AiPanelState; aiEnabled: boolean }) {
  const bgGradient = 'bg-gradient-to-b from-obsidian via-[#0d1822] to-[#0a1420]';

  if (!aiEnabled && state.status === 'idle') {
    return (
      <div className="border border-line bg-bgsoft p-5">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-3">
          🤖 Synthèse IA
        </div>
        <h3 className="serif text-[16px] font-semibold text-ink">Mode démo</h3>
        <p className="serif mt-2 text-[12.5px] italic text-ink-3">
          L&apos;analyse automatique du document n&apos;est pas active sur ce serveur.
          Pour l&apos;activer, ajoutez la clé&nbsp;:
        </p>
        <code className="mt-3 block bg-white px-3 py-2 font-mono text-[11px] text-ink-2">
          ANTHROPIC_API_KEY=&quot;sk-ant-…&quot;
        </code>
        <p className="serif mt-2 text-[11.5px] italic text-ink-4">
          dans <code className="font-mono">/var/www/cmipaportal/shared/.env.production</code>
        </p>
      </div>
    );
  }

  if (state.status === 'idle') {
    return (
      <div className={`relative overflow-hidden border border-obsidian ${bgGradient} p-6 text-white`}>
        <div className="absolute right-2 top-2 text-[24px] opacity-10">✨</div>
        <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-500">
          🤖 Synthèse IA · En attente
        </div>
        <h3 className="serif text-[17px] font-semibold leading-tight">
          Joignez un fichier pour lancer l&apos;analyse automatique
        </h3>
        <p className="serif mt-3 text-[13px] italic text-white/65">
          Dès qu&apos;un PDF ou une image est sélectionné, Claude lit le
          document, pré-remplit les champs à gauche et résume l&apos;essentiel
          en moins de 50&nbsp;mots ici.
        </p>
        <ul className="mt-4 space-y-1.5 text-[11.5px] text-white/55">
          <li>✓ Extraction de l&apos;émetteur (nom, organisation, email)</li>
          <li>✓ Détection de la nature du document (agrément, plainte, etc.)</li>
          <li>✓ Synopsis &lt; 50 mots</li>
          <li>✓ Niveau de confiance auto-évalué</li>
        </ul>
      </div>
    );
  }

  if (state.status === 'analyzing') {
    return (
      <div className={`relative overflow-hidden border border-obsidian ${bgGradient} p-6 text-white`}>
        <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-500">
          🤖 Synthèse IA · Analyse en cours
        </div>
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
          <h3 className="serif text-[16px] font-semibold leading-tight">
            Claude lit {state.fileName}…
          </h3>
        </div>
        <p className="serif mt-3 text-[13px] italic text-white/65">
          Habituellement 2–6 secondes pour un courrier d&apos;une page.
        </p>
        <div className="mt-5 space-y-2">
          {['Reconnaissance optique du texte', 'Identification de l\'émetteur', 'Détection de la nature', 'Rédaction du synopsis'].map((step) => (
            <div key={step} className="flex items-center gap-2 text-[12px] text-white/55">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500" />
              {step}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="border border-cmred bg-cmred-50 p-5">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
          ⚠ Erreur d&apos;analyse IA
        </div>
        <p className="serif text-[13px] italic text-cmred-900">{state.error}</p>
        <p className="serif mt-3 text-[12px] italic text-ink-3">
          Saisissez les champs manuellement à gauche — l&apos;enregistrement reste possible.
        </p>
      </div>
    );
  }

  // status === 'ok'
  const d = state.data;
  const confidenceColor =
    d.confidence === 'high'
      ? 'text-cmgreen-300'
      : d.confidence === 'medium'
      ? 'text-gold-400'
      : 'text-cmred-300';
  const confidenceLabel =
    d.confidence === 'high' ? 'Élevée' : d.confidence === 'medium' ? 'Moyenne' : 'Faible';

  return (
    <div className={`relative overflow-hidden border border-obsidian ${bgGradient} p-6 text-white`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-500">
          ✨ Synthèse IA · {state.mode === 'live' ? 'Claude' : 'Démo'}
        </div>
        <div className={'text-[10.5px] font-bold uppercase tracking-[0.16em] ' + confidenceColor}>
          ● {confidenceLabel}
        </div>
      </div>

      <h3 className="serif mb-2 text-[14px] font-semibold leading-tight text-white">
        Document analysé
      </h3>
      <p className="serif text-[14px] leading-[1.6] text-white">
        « {d.synopsis} »
      </p>

      <div className="mt-5 border-t border-white/15 pt-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          Champs reconnus dans le document
        </div>
        <div className="space-y-1 text-[12px]">
          {d.senderName && <KV k="Émetteur" v={d.senderName} />}
          {d.senderOrganization && <KV k="Organisation" v={d.senderOrganization} />}
          {d.senderEmail && <KV k="Email" v={d.senderEmail} />}
          {d.senderPhone && <KV k="Téléphone" v={d.senderPhone} />}
          {d.subject && <KV k="Objet" v={d.subject} />}
          {d.nature && <KV k="Nature" v={d.nature} />}
        </div>
        <p className="serif mt-4 text-[11px] italic text-white/55">
          Champs surlignés en vert à gauche = pré-remplis par l&apos;IA. Vous pouvez tout corriger.
        </p>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/55">{k}</span>
      <span className="truncate text-right text-white" title={v}>{v}</span>
    </div>
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
  aiFilled,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  error?: string;
  aiFilled?: boolean;
}) {
  return (
    <div className={aiFilled ? 'rounded-sm ring-1 ring-cmgreen-800/35' : ''}>
      <label
        htmlFor={name}
        className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
      >
        <span>{label}</span>
        {aiFilled && (
          <span className="rounded-sm bg-cmgreen-50 px-1.5 py-0.5 text-[9px] font-bold text-cmgreen-800">
            ✨ IA
          </span>
        )}
      </label>
      {children}
      {error && (
        <div className="mt-1 text-[11.5px] font-medium text-cmred">{error}</div>
      )}
    </div>
  );
}
