'use client';

import { useActionState, useRef, useEffect, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  registerArrivedDocument,
  type RegisterArriveeState,
} from '@/lib/actions/courrier-arrivee';
import {
  analyzeUploadedDocument,
  type AnalyzedDocument,
} from '@/lib/actions/analyze-document';

const initial: RegisterArriveeState = {};

const NATURE_VALUES = [
  'AGREMENT_REQUEST',
  'GENERAL_CORRESPONDENCE',
  'OFFICIAL_NOTIFICATION',
  'PARTNERSHIP_PROPOSAL',
  'COMPLAINT',
  'REPORT',
  'OTHER',
] as const;

const CHANNEL_VALUES = ['COURRIER_PHYSICAL', 'ONLINE', 'ANTENNE'] as const;

// senderType is persisted as the canonical French string; we localise the
// visible label only, keeping the stored value stable.
const SENDER_TYPES: { value: string; en: string }[] = [
  { value: 'Investisseur', en: 'Investor' },
  { value: 'Particulier', en: 'Individual' },
  { value: 'Administration', en: 'Administration' },
  { value: 'Entreprise', en: 'Company' },
  { value: 'Autre', en: 'Other' },
];

type AiPanelState =
  | { status: 'idle' }
  | { status: 'analyzing'; fileName: string }
  | { status: 'ok'; data: AnalyzedDocument; mode: 'live' | 'stub'; fileName: string }
  | { status: 'error'; error: string };

export function RegisterForm({ aiEnabled }: { aiEnabled: boolean }) {
  const t = useTranslations('CourrierArrivee');
  const tNature = useTranslations('DocNatureLong');
  const tChannel = useTranslations('SourceChannel');
  const locale = useLocale();
  const isEn = locale === 'en';

  const [state, formAction, pending] = useActionState(registerArrivedDocument, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [ai, setAi] = useState<AiPanelState>({ status: 'idle' });
  const [analyzing, startAnalyzing] = useTransition();
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

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
              {t('successHeading')}
            </div>
            <div className="mt-1 font-mono text-[15px] font-bold text-cmgreen-900">
              {state.reference}
            </div>
          </div>
        )}

        {/* File picker first */}
        <fieldset className="border border-line bg-white">
          <legend className="ml-3 bg-white px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            {t('stepDocument')}
          </legend>
          <div className="p-5">
            <label className="flex items-center gap-3 border border-dashed border-line-2 bg-bgsoft px-4 py-4 hover:border-cmgreen-800">
              <span className="bg-obsidian px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-500">
                {t('filePicker')}
              </span>
              <span className="flex-1 truncate text-[12.5px] italic text-ink-3">
                {fileName || t('filePickerEmpty')}
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
              {aiEnabled ? t('filePickerHintActive') : t('filePickerHintInactive')}
            </p>
          </div>
        </fieldset>

        {/* Sender block */}
        <fieldset className="border border-line bg-white">
          <legend className="ml-3 bg-white px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            {t('stepSender')}
          </legend>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label={t('labelFullName')} name="senderName" error={state.fieldErrors?.senderName} aiFilled={aiFilledFields.has('senderName')} tooltip={t('preFilledTooltip')}>
              <input
                name="senderName"
                value={v.senderName}
                onChange={(e) => { setV({ ...v, senderName: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderName'); return n; }); }}
                required
                maxLength={120}
                placeholder={isEn ? 'e.g. Aïcha Bouba' : 'ex. Aïcha Bouba'}
                className={inputCls}
              />
            </Field>
            <Field label={t('labelEmail')} name="senderEmail" error={state.fieldErrors?.senderEmail} aiFilled={aiFilledFields.has('senderEmail')} tooltip={t('preFilledTooltip')}>
              <input
                type="email"
                name="senderEmail"
                value={v.senderEmail}
                onChange={(e) => { setV({ ...v, senderEmail: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderEmail'); return n; }); }}
                required
                placeholder="e.g. contact@example.cm"
                className={inputCls}
              />
            </Field>
            <Field label={t('labelOrganization')} name="senderOrganization" aiFilled={aiFilledFields.has('senderOrganization')} tooltip={t('preFilledTooltip')}>
              <input
                name="senderOrganization"
                value={v.senderOrganization}
                onChange={(e) => { setV({ ...v, senderOrganization: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderOrganization'); return n; }); }}
                maxLength={160}
                placeholder={isEn ? 'e.g. Cameroon Solar Power SA' : 'ex. Cameroun Solar Power SA'}
                className={inputCls}
              />
            </Field>
            <Field label={t('labelPhone')} name="senderPhone" aiFilled={aiFilledFields.has('senderPhone')} tooltip={t('preFilledTooltip')}>
              <input
                name="senderPhone"
                value={v.senderPhone}
                onChange={(e) => { setV({ ...v, senderPhone: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderPhone'); return n; }); }}
                maxLength={40}
                placeholder="e.g. +237 6 55 44 33 22"
                className={inputCls}
              />
            </Field>
            <Field label={t('labelSenderType')} name="senderType" aiFilled={aiFilledFields.has('senderType')} tooltip={t('preFilledTooltip')}>
              <select
                name="senderType"
                value={v.senderType}
                onChange={(e) => { setV({ ...v, senderType: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('senderType'); return n; }); }}
                className={selectCls}
              >
                {SENDER_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>{isEn ? s.en : s.value}</option>
                ))}
              </select>
            </Field>
          </div>
        </fieldset>

        {/* Document metadata block */}
        <fieldset className="border border-line bg-white">
          <legend className="ml-3 bg-white px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            {t('stepMetadata')}
          </legend>
          <div className="grid gap-4 p-5 md:grid-cols-2">
            <Field label={t('labelChannel')} name="sourceChannel" error={state.fieldErrors?.sourceChannel}>
              <select name="sourceChannel" required defaultValue="COURRIER_PHYSICAL" className={selectCls}>
                {CHANNEL_VALUES.map((c) => (
                  <option key={c} value={c}>{tChannel(c)}</option>
                ))}
              </select>
            </Field>
            <Field label={t('labelNature')} name="nature" error={state.fieldErrors?.nature} aiFilled={aiFilledFields.has('nature')} tooltip={t('preFilledTooltip')}>
              <select
                name="nature"
                value={v.nature}
                onChange={(e) => { setV({ ...v, nature: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('nature'); return n; }); }}
                required
                className={selectCls}
              >
                {NATURE_VALUES.map((n) => (
                  <option key={n} value={n}>{tNature(n)}</option>
                ))}
              </select>
            </Field>
            <div className="md:col-span-2">
              <Field label={t('labelSubject')} name="subject" error={state.fieldErrors?.subject} aiFilled={aiFilledFields.has('subject')} tooltip={t('preFilledTooltip')}>
                <input
                  name="subject"
                  value={v.subject}
                  onChange={(e) => { setV({ ...v, subject: e.target.value }); setAiFilledFields((s) => { const n = new Set(s); n.delete('subject'); return n; }); }}
                  required
                  minLength={5}
                  maxLength={400}
                  placeholder={t('subjectPlaceholder')}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label={t('labelNotes')} name="notes">
                <textarea
                  name="notes"
                  rows={3}
                  maxLength={2000}
                  placeholder={t('notesPlaceholder')}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </fieldset>

        <div className="flex items-center justify-between border-t border-line pt-5">
          <p className="serif text-[12.5px] italic text-ink-3">
            {t('submitFooter')}
          </p>
          <button
            type="submit"
            disabled={pending || analyzing}
            className="bg-blue-700 px-6 py-3 text-[12.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            {pending ? t('submitting') : t('submitButton')}
          </button>
        </div>
      </form>

      {/* ====== Right: synopsis panel ====== */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <AiPanel state={ai} aiEnabled={aiEnabled} t={t} />
      </aside>
    </div>
  );
}

type TArrivee = ReturnType<typeof useTranslations<'CourrierArrivee'>>;

function AiPanel({ state, aiEnabled, t }: { state: AiPanelState; aiEnabled: boolean; t: TArrivee }) {
  // NOTE: this MUST be a template literal so ${bgGradient} interpolates.
  const panelDark = 'max-h-[340px] overflow-y-auto relative overflow-hidden border border-obsidian bg-gradient-to-b from-obsidian via-[#0d1822] to-[#0a1420] p-6 text-white';

  if (!aiEnabled && state.status === 'idle') {
    return (
      <div className="max-h-[340px] overflow-y-auto border border-line bg-bgsoft p-5">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-3">
          {t('panelDemoTitle')}
        </div>
        <h3 className="serif text-[16px] font-semibold text-ink">{t('panelDemoHeading')}</h3>
        <p className="serif mt-2 text-[12.5px] italic text-ink-3">
          {t('panelDemoIntro')}
        </p>
      </div>
    );
  }

  if (state.status === 'idle') {
    return (
      <div className={panelDark}>
        <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-500">
          {t('panelIdleTitle')}
        </div>
        <h3 className="serif text-[17px] font-semibold leading-tight">
          {t('panelIdleHeading')}
        </h3>
        <p className="serif mt-3 text-[13px] italic text-white/65">
          {t('panelIdleIntro')}
        </p>
        <ul className="mt-4 space-y-1.5 text-[11.5px] text-white/55">
          <li>{t('panelIdleBullet1')}</li>
          <li>{t('panelIdleBullet2')}</li>
          <li>{t('panelIdleBullet3')}</li>
          <li>{t('panelIdleBullet4')}</li>
        </ul>
      </div>
    );
  }

  if (state.status === 'analyzing') {
    return (
      <div className={panelDark}>
        <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-500">
          {t('panelAnalyzing')}
        </div>
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
          <h3 className="serif text-[16px] font-semibold leading-tight">
            {t('panelAnalyzingReading', { fileName: state.fileName })}
          </h3>
        </div>
        <p className="serif mt-3 text-[13px] italic text-white/65">
          {t('panelAnalyzingHint')}
        </p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="max-h-[340px] overflow-y-auto border border-cmred bg-cmred-50 p-5">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
          {t('panelError')}
        </div>
        <p className="serif text-[13px] italic text-cmred-900">{state.error}</p>
        <p className="serif mt-3 text-[12px] italic text-ink-3">
          {t('panelErrorFooter')}
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
    d.confidence === 'high' ? t('confidenceHigh') : d.confidence === 'medium' ? t('confidenceMedium') : t('confidenceLow');

  return (
    <div className={panelDark}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-500">
          {t('panelTitle')}
        </div>
        <div className={'text-[10.5px] font-bold uppercase tracking-[0.16em] ' + confidenceColor}>
          ● {confidenceLabel}
        </div>
      </div>

      <h3 className="serif mb-2 text-[14px] font-semibold leading-tight text-white">
        {t('panelOkHeading')}
      </h3>
      <p className="serif text-[14px] leading-[1.6] text-white">
        « {d.synopsis} »
      </p>

      <div className="mt-5 border-t border-white/15 pt-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
          {t('panelFieldsHeading')}
        </div>
        <div className="space-y-1 text-[12px]">
          {d.senderName && <KV k={t('labelFullName')} v={d.senderName} />}
          {d.senderOrganization && <KV k={t('labelOrganization')} v={d.senderOrganization} />}
          {d.senderEmail && <KV k={t('labelEmail')} v={d.senderEmail} />}
          {d.senderPhone && <KV k={t('labelPhone')} v={d.senderPhone} />}
          {d.subject && <KV k={t('labelSubject')} v={d.subject} />}
          {d.nature && <KV k={t('labelNature')} v={d.nature} />}
        </div>
        <p className="serif mt-4 text-[11px] italic text-white/55">
          {t('panelFieldsFooter')}
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
  'w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800';

function Field({
  label,
  name,
  children,
  error,
  aiFilled,
  tooltip,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
  error?: string;
  aiFilled?: boolean;
  tooltip?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
      >
        <span>{label}</span>
        {aiFilled && (
          <span className="rounded-sm bg-cmgreen-50 px-1.5 py-0.5 text-[10px] font-bold text-cmgreen-800" title={tooltip}>
            ✓
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
