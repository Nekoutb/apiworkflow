'use client';

import { useState, useTransition } from 'react';
import {
  runDocumentAnalysisAction,
  runDossierAnalysisAction,
} from '@/lib/actions/ai-analysis';

export type AiAnalysisItem = {
  id: string;
  documentId: string | null;
  documentTitle: string | null;     // FR title, null when dossier-level
  generatedAt: string;              // ISO
  summary: string;
  contentJson: unknown;
  modelName: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
};

export function AiPane({
  conventionId,
  claudeLive,
  analyses,
  canAct,
}: {
  conventionId: string;
  claudeLive: boolean;
  analyses: AiAnalysisItem[];
  canAct: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const runDossier = () => {
    const fd = new FormData();
    fd.set('conventionId', conventionId);
    setError(null);
    startTransition(async () => {
      try { await runDossierAnalysisAction(fd); }
      catch (e) { setError((e as Error).message); }
    });
  };

  return (
    <div className="border border-line bg-white">
      <header className="border-b border-line bg-obsidian px-4 py-3 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[14px]">⚡</span>
            <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-500">
              Assistant IA
            </span>
          </div>
          <span className={
            'inline-block border px-1.5 py-0 text-[9.5px] font-bold uppercase tracking-[0.12em] ' +
            (claudeLive
              ? 'border-cmgreen-700 bg-cmgreen-50 text-cmgreen-800'
              : 'border-gold-600 bg-gold-50 text-gold-700')
          }>
            {claudeLive ? 'Live · Claude' : 'Mode démo'}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] italic text-white/65">
          Analyse de conformité Art. 6 — OCR par document, verdict global du dossier.
        </p>
      </header>

      {/* Dossier-wide analysis */}
      <div className="border-b border-line px-4 py-3">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
          Analyse de complétude du dossier
        </h4>
        <button
          type="button"
          onClick={runDossier}
          disabled={pending || !canAct}
          title={!canAct ? 'Lecture seule' : undefined}
          className="mt-2 w-full bg-obsidian py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-500 transition hover:bg-ink disabled:opacity-50"
        >
          {pending ? 'Analyse en cours…' : '⚡ Lancer l\'analyse du dossier'}
        </button>
        {error && <div className="mt-2 text-[11px] italic text-cmred">{error}</div>}
      </div>

      {/* Latest dossier-level analysis */}
      <DossierAnalysisDisplay analyses={analyses.filter((a) => a.documentId === null)} />

      {/* Document analyses summary */}
      <div className="border-t border-line px-4 py-3">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">
          Analyses par pièce ({analyses.filter((a) => a.documentId).length})
        </h4>
        <div className="mt-2 space-y-2">
          {analyses.filter((a) => a.documentId).length === 0 && (
            <p className="text-[11.5px] italic text-ink-3">
              Cliquez sur ⚡ à côté d&apos;une pièce pour l&apos;analyser individuellement.
            </p>
          )}
          {analyses.filter((a) => a.documentId).slice(0, 6).map((a) => (
            <DocAnalysisCard key={a.id} a={a} />
          ))}
        </div>
      </div>

      {!claudeLive && (
        <div className="border-t border-line bg-bgsoft px-4 py-3 text-[11px] italic text-ink-3">
          <strong className="block text-[10px] font-bold uppercase tracking-[0.14em] text-gold-700">
            Pour activer Claude
          </strong>
          Ajoutez la variable <code className="font-mono">ANTHROPIC_API_KEY</code> dans les
          réglages du projet Vercel. Sans clé, le pane fonctionne en mode démo (résultats
          déterministes).
        </div>
      )}
    </div>
  );
}

function DossierAnalysisDisplay({ analyses }: { analyses: AiAnalysisItem[] }) {
  const latest = analyses.length > 0 ? analyses[0] : null;
  if (!latest) {
    return (
      <div className="border-b border-line px-4 py-3 text-[12px] italic text-ink-3">
        Aucune analyse de dossier encore. Lancez-en une ci-dessus.
      </div>
    );
  }
  const content = latest.contentJson as {
    overallVerdict?: string;
    verdictReason?: string;
    completeness?: { present?: string[]; missing?: string[] };
    redFlags?: string[];
    recommendation?: string;
    recommendationReason?: string;
    categoryConfirmed?: string;
  } | null;
  if (!content || !content.overallVerdict) {
    return (
      <div className="border-b border-line px-4 py-3 text-[12px] italic text-cmred">
        Analyse partielle: {latest.summary}
      </div>
    );
  }

  return (
    <div className="border-b border-line px-4 py-4 text-[12.5px]">
      <div className={
        'border px-3 py-2 ' +
        (content.overallVerdict === 'CONFORME'
          ? 'border-cmgreen-700 bg-cmgreen-50'
          : content.overallVerdict === 'NON_CONFORME'
            ? 'border-cmred bg-cmred-50'
            : 'border-gold-600 bg-gold-50')
      }>
        <div className="text-[10px] font-bold uppercase tracking-[0.14em]">
          Verdict global
        </div>
        <div className="serif mt-1 text-[15px] font-bold leading-tight text-ink">
          {prettyVerdict(content.overallVerdict)}
        </div>
        {content.verdictReason && (
          <p className="mt-1 text-[12px] italic text-ink-2">{content.verdictReason}</p>
        )}
      </div>

      {content.completeness && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cmgreen-800">
              Présentes ({content.completeness.present?.length ?? 0})
            </div>
            <ul className="mt-1 space-y-0.5">
              {(content.completeness.present ?? []).map((k) => (
                <li key={k} className="truncate text-ink-2">✓ {prettyKind(k)}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cmred">
              Manquantes ({content.completeness.missing?.length ?? 0})
            </div>
            <ul className="mt-1 space-y-0.5">
              {(content.completeness.missing ?? []).map((k) => (
                <li key={k} className="truncate text-ink-2">× {prettyKind(k)}</li>
              ))}
              {(content.completeness.missing ?? []).length === 0 && (
                <li className="italic text-ink-3">—</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {content.redFlags && content.redFlags.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cmred">
            Points d&apos;attention
          </div>
          <ul className="mt-1 space-y-0.5 text-[11.5px] text-ink-2">
            {content.redFlags.map((f, i) => (
              <li key={i} className="flex gap-1.5"><span className="text-cmred">⚠</span>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {content.recommendation && (
        <div className="mt-3 border-t border-line pt-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
            Recommandation
          </div>
          <div className="mt-0.5 text-[12px] font-semibold text-ink">{prettyRecommendation(content.recommendation)}</div>
          {content.recommendationReason && (
            <p className="text-[11.5px] italic text-ink-3">{content.recommendationReason}</p>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-line pt-2 text-[10px] uppercase tracking-[0.12em] text-ink-4">
        Catégorie&nbsp;: {content.categoryConfirmed ?? '—'}{' '}
        · {new Date(latest.generatedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        {latest.tokensOut !== null && <span> · {latest.tokensIn ?? 0}/{latest.tokensOut} tokens</span>}
      </div>
    </div>
  );
}

function DocAnalysisCard({ a }: { a: AiAnalysisItem }) {
  const content = a.contentJson as {
    summary?: string;
    classification?: string;
    classificationReason?: string;
    legibility?: string;
    keyFindings?: string[];
  } | null;
  return (
    <details className="border border-line bg-bgsoft">
      <summary className="cursor-pointer px-3 py-2 text-[12px]">
        <span className="font-semibold text-ink">{a.documentTitle ?? 'Pièce'}</span>
        {content?.classification && (
          <span className={
            'ml-2 inline-block border px-1 py-0 text-[9.5px] font-bold uppercase tracking-[0.12em] ' +
            (content.classification === 'CONFORME'
              ? 'border-cmgreen-700 text-cmgreen-800'
              : content.classification === 'NON_CONFORME'
                ? 'border-cmred text-cmred'
                : 'border-gold-600 text-gold-700')
          }>
            {content.classification}
          </span>
        )}
      </summary>
      <div className="border-t border-line px-3 py-2 text-[11.5px]">
        <p className="text-ink-2">{content?.summary ?? a.summary}</p>
        {content?.keyFindings && content.keyFindings.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {content.keyFindings.map((f, i) => (
              <li key={i} className="text-ink-3">• {f}</li>
            ))}
          </ul>
        )}
        <div className="mt-2 text-[10px] uppercase tracking-[0.12em] text-ink-4">
          {new Date(a.generatedAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          {content?.legibility && <span> · lisibilité {content.legibility.toLowerCase()}</span>}
        </div>
      </div>
    </details>
  );
}

function prettyVerdict(v: string): string {
  switch (v) {
    case 'CONFORME':              return '✓ Conforme';
    case 'CONFORME_AVEC_RESERVES': return '⚠ Conforme avec réserves';
    case 'NON_CONFORME':           return '× Non conforme';
    default:                       return v;
  }
}

function prettyRecommendation(r: string): string {
  switch (r) {
    case 'PROCEDER':              return 'Procéder à la signature & au handoff';
    case 'RENVOYER_INVESTISSEUR': return 'Renvoyer le dossier à l\'investisseur';
    case 'DEMANDER_PRECISIONS':   return 'Demander des précisions';
    default:                      return r;
  }
}

const KIND_FR: Record<string, string> = {
  ACTIVITY_AUTHORIZATION: 'Autorisation d\'exercice',
  RECRUITMENT_PLAN:       'Plan de recrutement',
  TECH_TRANSFER_PLAN:     'Plan de transfert',
  LOCAL_SUBCONTRACTING:   'Plan de sous-traitance',
  FINANCING_PROOF:        'Justif. financement',
  FEASIBILITY_STUDY:      'Étude de faisabilité',
  REGISTRATION:           'RCCM',
  TAX_ID:                 'NIU',
  NON_REDEVANCE:          'Non-redevance',
  COMPANY_STATUTES:       'Statuts',
};
function prettyKind(k: string): string {
  return KIND_FR[k] ?? k;
}
