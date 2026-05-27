'use client';

import { useState, useTransition, useEffect, useActionState } from 'react';
import {
  getOrComputeDispatchSuggestion,
  reanalyzeDispatch,
  type AnalyzeResult,
} from '@/lib/actions/dg-analyze';
import { dispatchToUnit, type DispatchResult } from '@/lib/actions/dg-dispatch';
import { roleLabel, roleMeta, rolesGrouped } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';

type Cached = {
  summary: string;
  data: Record<string, unknown>;
  generatedAt: Date;
  modelName: string | null;
};

type Suggestion = {
  summary: string;
  suggestedRole: StaffRole;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  alternatives?: StaffRole[];
};

type State =
  | { kind: 'idle-empty' }                  // no cache, idle
  | { kind: 'cached'; s: Suggestion; at: Date; modelName: string | null }
  | { kind: 'analyzing' }
  | { kind: 'fresh'; s: Suggestion; at: Date; mode: string; modelName: string | null }
  | { kind: 'error'; msg: string };

export function DispatchAiPanel({
  documentId,
  aiEnabled,
  cached,
}: {
  documentId: string;
  aiEnabled: boolean;
  cached: Cached | null;
}) {
  const [state, setState] = useState<State>(
    cached
      ? {
          kind: 'cached',
          s: cached.data as unknown as Suggestion,
          at: new Date(cached.generatedAt),
          modelName: cached.modelName,
        }
      : { kind: 'idle-empty' },
  );
  const [pending, start] = useTransition();

  // Auto-analyze if no cached entry exists and AI is enabled
  useEffect(() => {
    if (state.kind === 'idle-empty' && aiEnabled) {
      runAnalysis(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runAnalysis(force: boolean) {
    setState({ kind: 'analyzing' });
    start(async () => {
      const result: AnalyzeResult = force
        ? await reanalyzeDispatch(documentId)
        : await getOrComputeDispatchSuggestion(documentId);
      if (!result.ok) {
        setState({ kind: 'error', msg: result.error });
        return;
      }
      setState({
        kind: 'fresh',
        s: result.data,
        at: result.generatedAt,
        mode: result.mode,
        modelName: result.modelName ?? null,
      });
    });
  }

  return (
    <div className="lg:sticky lg:top-6 lg:self-start">
      <Inner
        state={state}
        documentId={documentId}
        aiEnabled={aiEnabled}
        onAnalyze={() => runAnalysis(false)}
        onReanalyze={() => runAnalysis(true)}
        pending={pending}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------

function Inner({
  state, documentId, aiEnabled, onAnalyze, onReanalyze, pending,
}: {
  state: State;
  documentId: string;
  aiEnabled: boolean;
  onAnalyze: () => void;
  onReanalyze: () => void;
  pending: boolean;
}) {
  const dark = 'bg-gradient-to-b from-obsidian via-[#0d1822] to-[#0a1420]';

  if (state.kind === 'idle-empty' && !aiEnabled) {
    return (
      <div className="border border-line bg-bgsoft p-5">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-3">
          🤖 Suggestion de dispatch IA
        </div>
        <h3 className="serif text-[16px] font-semibold text-ink">Mode démo</h3>
        <p className="serif mt-2 text-[12.5px] italic text-ink-3">
          L&apos;analyse automatique n&apos;est pas active sur ce serveur.
          Ajoutez la clé&nbsp;:
        </p>
        <code className="mt-3 block bg-white px-3 py-2 font-mono text-[11px] text-ink-2">
          ANTHROPIC_API_KEY=&quot;sk-ant-…&quot;
        </code>
        <p className="serif mt-2 text-[11.5px] italic text-ink-4">
          dans <code className="font-mono">/var/www/cmipaportal/shared/.env.production</code>
        </p>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={pending}
          className="mt-4 w-full bg-obsidian px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-gold-500 hover:bg-ink disabled:opacity-50"
        >
          {pending ? '…' : 'Lancer (mode stub)'}
        </button>
      </div>
    );
  }

  if (state.kind === 'analyzing') {
    return (
      <div className={`relative overflow-hidden border border-obsidian ${dark} p-6 text-white`}>
        <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-500">
          🤖 Analyse en cours
        </div>
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold-500 border-t-transparent" />
          <h3 className="serif text-[16px] font-semibold">Claude lit le document…</h3>
        </div>
        <ul className="mt-5 space-y-2 text-[12px] text-white/55">
          {['Lecture du contexte (émetteur, objet, nature)', 'Comparaison avec l\'organigramme officiel', 'Sélection de l\'unité la plus appropriée', 'Rédaction du raisonnement'].map((step) => (
            <li key={step} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold-500" />
              {step}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="border border-cmred bg-cmred-50 p-5">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
          ⚠ Erreur d&apos;analyse
        </div>
        <p className="serif text-[13px] italic text-cmred-900">{state.msg}</p>
        <button
          type="button"
          onClick={onReanalyze}
          disabled={pending}
          className="mt-4 border border-cmred bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cmred hover:bg-cmred hover:text-white disabled:opacity-50"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // cached or fresh — both render the same body
  if (state.kind !== 'cached' && state.kind !== 'fresh') {
    // Shouldn't reach here (idle-empty + AI on disabled path handled above);
    // belts-and-suspenders fallback.
    return (
      <div className="border border-line bg-white p-5 text-[12.5px] italic text-ink-3">
        Analyse non disponible.
      </div>
    );
  }
  const s = state.s;
  const at = state.at;
  const isCached = state.kind === 'cached';
  const modeLabel = isCached
    ? `cache · ${at.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
    : state.mode === 'stub'
    ? 'mode démo (stub)'
    : 'Claude · à l\'instant';

  const confidenceColor =
    s.confidence === 'high'   ? 'text-cmgreen-300' :
    s.confidence === 'medium' ? 'text-gold-400'    :
                                'text-cmred-300';
  const confidenceLabel =
    s.confidence === 'high'   ? 'Élevée' :
    s.confidence === 'medium' ? 'Moyenne' :
                                'Faible';

  const meta = roleMeta(s.suggestedRole);

  return (
    <div className="space-y-4">
      <div className={`relative overflow-hidden border border-obsidian ${dark} p-6 text-white`}>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.24em] text-gold-500">
            ✨ Suggestion de dispatch · IA
          </div>
          <div className={'text-[10.5px] font-bold uppercase tracking-[0.16em] ' + confidenceColor}>
            ● {confidenceLabel}
          </div>
        </div>

        {/* Synopsis */}
        <h3 className="serif mb-2 text-[12.5px] font-semibold uppercase tracking-[0.14em] text-white/55">
          Synopsis
        </h3>
        <p className="serif text-[14px] leading-[1.55] text-white">« {s.summary} »</p>

        {/* Suggested unit */}
        <div className="mt-6 border-t border-white/15 pt-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-500">
            Unité suggérée
          </div>
          <div className="mt-2 text-[18px] font-bold leading-tight text-white">
            {meta?.fr ?? roleLabel(s.suggestedRole)}
          </div>
          <div className="mt-1 font-mono text-[11px] text-white/55">
            {s.suggestedRole}{meta?.article && meta.article !== '—' ? ` · ${meta.article}` : ''}
          </div>
        </div>

        {/* Reasoning */}
        <div className="mt-5 border-t border-white/15 pt-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-500">
            Raisonnement
          </div>
          <p className="serif mt-2 text-[13px] italic leading-[1.55] text-white/85">{s.reasoning}</p>
        </div>

        {/* Alternatives */}
        {s.alternatives && s.alternatives.length > 0 && (
          <div className="mt-5 border-t border-white/15 pt-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-500">
              Alternatives
            </div>
            <ul className="mt-2 space-y-1 text-[12px]">
              {s.alternatives.map((r: StaffRole) => (
                <li key={r} className="flex justify-between gap-3">
                  <span className="text-white">{roleLabel(r)}</span>
                  <span className="font-mono text-white/45">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3 text-[10.5px] text-white/45">
          <span>{modeLabel}</span>
          <button
            type="button"
            onClick={onReanalyze}
            disabled={pending}
            className="text-gold-500 hover:underline disabled:opacity-50"
          >
            {pending ? '…' : '↻ Re-analyser'}
          </button>
        </div>
      </div>

      {/* Dispatch form — B8 */}
      <DispatchForm
        documentId={documentId}
        suggestedRole={s.suggestedRole}
        alternatives={s.alternatives ?? []}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
//  DispatchForm — the live B8 action
// ----------------------------------------------------------------------------

const initialDispatch: DispatchResult = {};

function DispatchForm({
  documentId,
  suggestedRole,
  alternatives,
}: {
  documentId: string;
  suggestedRole: StaffRole;
  alternatives: StaffRole[];
}) {
  const [state, formAction, pending] = useActionState(dispatchToUnit, initialDispatch);
  const [overrideMode, setOverrideMode] = useState(false);
  const [picked, setPicked] = useState<StaffRole>(suggestedRole);
  const groups = rolesGrouped();

  const effectiveRole = overrideMode ? picked : suggestedRole;
  const effectiveLabel = roleLabel(effectiveRole);
  const accepted = !overrideMode || picked === suggestedRole;

  if (state.ok) {
    return (
      <div className="border-2 border-cmgreen-800 bg-cmgreen-50 p-5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
          ✓ Document dispatché
        </div>
        <h3 className="serif mt-2 text-[16px] font-bold text-ink">
          Transmis à {state.targetLabel ?? effectiveLabel}
        </h3>
        <p className="serif mt-2 text-[12.5px] italic text-cmgreen-900/80">
          Le document a été transféré via le Service du Courrier vers l&apos;unité cible.
          Il apparaît désormais dans la <strong>corbeille de cette unité</strong> (B11), où le chef
          d&apos;unité peut le prendre en charge ou le renvoyer.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/dg/corbeille"
            className="inline-block border border-cmgreen-800 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 hover:bg-cmgreen-800 hover:text-white"
          >
            ← Retour à la corbeille DG
          </a>
          <a
            href="/unit/corbeille"
            className="inline-block border border-cmgreen-800 bg-cmgreen-800 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white hover:bg-cmgreen-900"
          >
            Voir la corbeille unité →
          </a>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="border border-line bg-white">
      <div className="border-b border-line bg-bgsoft px-4 py-3">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
          ⬇ Dispatcher
        </div>
        <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
          Transmettre vers l&apos;unité responsable
        </h3>
      </div>

      <div className="space-y-4 p-5">
        {state.error && (
          <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
            {state.error}
          </div>
        )}

        <input type="hidden" name="documentId" value={documentId} />
        <input type="hidden" name="targetRole" value={effectiveRole} />
        <input type="hidden" name="acceptedSuggestion" value={accepted ? 'true' : 'false'} />

        {/* Mode selector */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => { setOverrideMode(false); setPicked(suggestedRole); }}
            className={
              'flex-1 border px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] transition ' +
              (!overrideMode
                ? 'border-cmgreen-800 bg-cmgreen-50 text-cmgreen-900'
                : 'border-line-2 bg-white text-ink-3 hover:border-ink-3')
            }
          >
            ✓ Accepter la suggestion IA
          </button>
          <button
            type="button"
            onClick={() => setOverrideMode(true)}
            className={
              'flex-1 border px-3 py-2 text-[10.5px] font-bold uppercase tracking-[0.14em] transition ' +
              (overrideMode
                ? 'border-gold-700 bg-gold-50 text-gold-700'
                : 'border-line-2 bg-white text-ink-3 hover:border-ink-3')
            }
          >
            ✎ Choisir une autre unité
          </button>
        </div>

        {/* Override picker — only when overrideMode is on */}
        {overrideMode && (
          <div>
            <label
              htmlFor="role-override"
              className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
            >
              Unité cible (organigramme · 37 rôles)
            </label>
            <select
              id="role-override"
              value={picked}
              onChange={(e) => setPicked(e.target.value as StaffRole)}
              className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
            >
              {groups.map((g) => (
                <optgroup key={g.group} label={g.label}>
                  {g.roles
                    .filter((r) => r.role !== 'DG' && r.role !== 'DGA' && r.role !== 'ADMIN')
                    .map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.shortFr} · {r.fr}
                        {r.article !== '—' ? ` (${r.article})` : ''}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {alternatives.length > 0 && (
              <div className="mt-2 text-[10.5px] text-ink-3">
                Alternatives proposées par l&apos;IA&nbsp;:{' '}
                {alternatives.map((r, i) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPicked(r)}
                    className="text-cmgreen-800 hover:underline"
                  >
                    {roleLabel(r)}{i < alternatives.length - 1 ? ', ' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div>
          <label
            htmlFor="instructions"
            className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
          >
            Instructions du DG (optionnel)
          </label>
          <textarea
            id="instructions"
            name="instructions"
            rows={3}
            maxLength={2000}
            placeholder="ex. À traiter en priorité · délai légal 10 jours."
            className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
          />
          <p className="mt-1 text-[10.5px] italic text-ink-4">
            Affichées comme note interne pour le chef d&apos;unité destinataire.
          </p>
        </div>

        {/* Confirmation pill */}
        <div className="border border-cmgreen-800/40 bg-cmgreen-50/50 px-3 py-2 text-[12px]">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cmgreen-900/70">
            Cible
          </div>
          <div className="mt-0.5 font-bold text-cmgreen-900">{effectiveLabel}</div>
          <div className="mt-0.5 font-mono text-[10.5px] text-cmgreen-900/70">{effectiveRole}</div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-cmgreen-800 px-4 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
        >
          {pending ? 'Dispatch en cours…' : `Dispatcher vers ${effectiveLabel} →`}
        </button>

        <p className="text-[10.5px] italic text-ink-4">
          Transit via le Service du Courrier (règle B14.5). Statut du document&nbsp;:
          AWAITING_DG_ANALYSIS → ASSIGNED.
        </p>
      </div>
    </form>
  );
}
