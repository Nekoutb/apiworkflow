'use client';

import { useState, useTransition, useActionState, useEffect } from 'react';
import {
  markInTreatment,
  returnToDg,
  delegateDown,
  returnUp,
  type ReturnToDgResult,
  type DelegateDownResult,
  type ReturnUpResult,
} from '@/lib/actions/unit-corbeille';
import { roleLabel, roleMeta } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';

type View =
  | 'menu'
  | 'returning'      // form: Renvoyer au DG (refusal)
  | 'returned'       //   ↳ success
  | 'delegating'     // form: Déléguer à une sous-unité (B12 · VERTICAL_DOWN)
  | 'delegated'      //   ↳ success
  | 'returning-up'   // form: Renvoyer à mon supérieur (B12 · RETURN_UP)
  | 'returned-up';   //   ↳ success

const initialReturn: ReturnToDgResult = {};
const initialDelegate: DelegateDownResult = {};
const initialReturnUp: ReturnUpResult = {};

export function UnitActions({
  documentId,
  documentReference,
  currentStatus,
  effectiveRole,
  effectiveRoleLabel,
  childrenRoles,
  parentRole,
}: {
  documentId: string;
  documentReference: string;
  currentStatus: string;
  effectiveRole: StaffRole;
  effectiveRoleLabel: string;
  childrenRoles: StaffRole[];
  parentRole: StaffRole | null;
}) {
  const [view, setView] = useState<View>('menu');
  const [takeError, setTakeError] = useState<string | null>(null);
  const [takeOk, setTakeOk] = useState<boolean>(currentStatus === 'IN_TREATMENT');
  const [takePending, startTake] = useTransition();

  const [returnState, returnAction, returnPending] = useActionState(returnToDg, initialReturn);
  const [delegateState, delegateAction, delegatePending] = useActionState(delegateDown, initialDelegate);
  const [returnUpState, returnUpAction, returnUpPending] = useActionState(returnUp, initialReturnUp);

  // Promote each form's success into the corresponding view via useEffect
  // (avoids setState-in-render warnings).
  useEffect(() => {
    if (returnState.ok && view !== 'returned') setView('returned');
  }, [returnState.ok, view]);
  useEffect(() => {
    if (delegateState.ok && view !== 'delegated') setView('delegated');
  }, [delegateState.ok, view]);
  useEffect(() => {
    if (returnUpState.ok && view !== 'returned-up') setView('returned-up');
  }, [returnUpState.ok, view]);

  function handleTake() {
    setTakeError(null);
    startTake(async () => {
      const result = await markInTreatment(documentId);
      if (result.error) {
        setTakeError(result.error);
        return;
      }
      setTakeOk(true);
    });
  }

  const canDelegate = childrenRoles.length > 0;
  const canReturnUp = !!parentRole;
  const parentMeta  = parentRole ? roleMeta(parentRole) : undefined;

  // =========================================================================
  //  Success views (each form has its own)
  // =========================================================================

  if (view === 'returned') {
    return (
      <SuccessCard
        kind="returned-dg"
        documentReference={documentReference}
        backHref="/unit/corbeille"
      />
    );
  }
  if (view === 'delegated') {
    return (
      <SuccessCard
        kind="delegated"
        documentReference={documentReference}
        backHref="/unit/corbeille"
        targetLabel={delegateState.targetLabel ?? ''}
      />
    );
  }
  if (view === 'returned-up') {
    return (
      <SuccessCard
        kind="returned-up"
        documentReference={documentReference}
        backHref="/unit/corbeille"
        targetLabel={returnUpState.targetLabel ?? ''}
      />
    );
  }

  // =========================================================================
  //  Form views
  // =========================================================================

  if (view === 'delegating') {
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <form action={delegateAction} className="border border-cmgreen-700 bg-white">
          <div className="border-b border-line bg-cmgreen-50/50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
              ⬇ Délégation interne (VERTICAL_DOWN)
            </div>
            <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
              Déléguer à une sous-unité de {effectiveRoleLabel}
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {delegateState.error && (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
                {delegateState.error}
              </div>
            )}

            <input type="hidden" name="documentId" value={documentId} />

            <div>
              <label
                htmlFor="targetRole"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Subordonné direct (organigramme) <span className="text-cmred">*</span>
              </label>
              <select
                id="targetRole"
                name="targetRole"
                required
                defaultValue={childrenRoles[0]}
                className={
                  'w-full border bg-white px-3.5 py-2.5 text-[13px] text-ink focus:outline-none focus:ring-1 ' +
                  (delegateState.fieldErrors?.targetRole
                    ? 'border-cmred focus:border-cmred focus:ring-cmred'
                    : 'border-line-2 focus:border-cmgreen-800 focus:ring-cmgreen-800')
                }
              >
                {childrenRoles.map((r) => {
                  const meta = roleMeta(r);
                  return (
                    <option key={r} value={r}>
                      {meta?.shortFr ?? r} · {meta?.fr ?? roleLabel(r)}
                      {meta?.article && meta.article !== '—' ? ` (${meta.article})` : ''}
                    </option>
                  );
                })}
              </select>
              {delegateState.fieldErrors?.targetRole && (
                <p className="mt-1 text-[11px] text-cmred">{delegateState.fieldErrors.targetRole}</p>
              )}
              <p className="mt-1 text-[10.5px] italic text-ink-4">
                Seuls les {childrenRoles.length} subordonné{childrenRoles.length > 1 ? 's' : ''} direct
                {childrenRoles.length > 1 ? 's' : ''} de {effectiveRoleLabel} apparaissent — la
                hiérarchie est verrouillée par l&apos;organigramme officiel.
              </p>
            </div>

            <div>
              <label
                htmlFor="message"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Instructions / contexte (optionnel)
              </label>
              <textarea
                id="message"
                name="message"
                rows={4}
                maxLength={2000}
                placeholder="ex. Préparer un avis technique sous 5 jours · attention au délai légal de 10 j."
                className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
              />
              <p className="mt-1 text-[10.5px] italic text-ink-4">
                Visible comme note interne pour le subordonné destinataire.
              </p>
            </div>

            <div className="border border-cmgreen-800/40 bg-cmgreen-50/50 px-3 py-2 text-[11.5px] italic text-cmgreen-900">
              ⓘ Le dossier reste au statut <code className="font-mono text-[11px] not-italic">IN_TREATMENT</code>
              — il change simplement de détenteur (vous → subordonné). Vous le verrez toujours dans
              l&apos;historique du document.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                disabled={delegatePending}
                className="flex-1 border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={delegatePending}
                className="flex-1 bg-cmgreen-800 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
              >
                {delegatePending ? 'Envoi…' : 'Déléguer →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'returning-up') {
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <form action={returnUpAction} className="border border-cmgreen-700 bg-white">
          <div className="border-b border-line bg-cmgreen-50/50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
              ⬆ Renvoi au supérieur (RETURN_UP)
            </div>
            <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
              Renvoyer à {parentMeta?.fr ?? roleLabel(parentRole!)}
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {returnUpState.error && (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
                {returnUpState.error}
              </div>
            )}

            <input type="hidden" name="documentId" value={documentId} />

            <div>
              <label
                htmlFor="message-up"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Votre avis / observations (recommandé)
              </label>
              <textarea
                id="message-up"
                name="message"
                rows={5}
                maxLength={2000}
                placeholder="ex. Dossier complet. Avis favorable sous réserve de la production du certificat de localisation par l'émetteur. Pièces vérifiées : 1, 2, 4."
                className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
              />
              <p className="mt-1 text-[10.5px] italic text-ink-4">
                Devient une note interne visible par votre supérieur. C&apos;est le moyen
                principal de transmettre votre avis sur le dossier.
              </p>
            </div>

            <div className="border border-cmgreen-800/40 bg-cmgreen-50/50 px-3 py-2 text-[11.5px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-cmgreen-900/70">
                Destinataire
              </div>
              <div className="mt-0.5 font-bold text-cmgreen-900">
                {parentMeta?.fr ?? roleLabel(parentRole!)}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-cmgreen-900/70">
                {parentRole}
                {parentMeta?.article && parentMeta.article !== '—' ? ` · ${parentMeta.article}` : ''}
              </div>
            </div>

            <p className="text-[10.5px] italic text-ink-4">
              Le dossier reste au statut <code className="font-mono">IN_TREATMENT</code>. Vous
              n&apos;êtes plus détenteur après cette action.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                disabled={returnUpPending}
                className="flex-1 border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={returnUpPending}
                className="flex-1 bg-cmgreen-800 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
              >
                {returnUpPending ? 'Envoi…' : `Renvoyer à ${parentMeta?.shortFr ?? '…'} →`}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'returning') {
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <form action={returnAction} className="border border-cmred bg-white">
          <div className="border-b border-line bg-cmred-50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
              ↩ Renvoyer au DG
            </div>
            <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
              Refuser cette affectation
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {returnState.error && (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
                {returnState.error}
              </div>
            )}

            <input type="hidden" name="documentId" value={documentId} />

            <div>
              <label
                htmlFor="reason"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Motif du renvoi <span className="text-cmred">*</span>
              </label>
              <textarea
                id="reason"
                name="reason"
                rows={5}
                required
                minLength={10}
                maxLength={2000}
                placeholder="ex. Ce dossier relève plutôt de la Direction de la Promotion, sous-direction Étranger (zone Europe) — l'émetteur est basé à Paris."
                className={
                  'w-full border bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 ' +
                  (returnState.fieldErrors?.reason
                    ? 'border-cmred focus:border-cmred focus:ring-cmred'
                    : 'border-line-2 focus:border-cmgreen-800 focus:ring-cmgreen-800')
                }
              />
              {returnState.fieldErrors?.reason && (
                <p className="mt-1 text-[11px] text-cmred">{returnState.fieldErrors.reason}</p>
              )}
              <p className="mt-1 text-[10.5px] italic text-ink-4">
                Visible par le DG dans les notes du dossier. Soyez explicite — cela aide la
                ré-affectation.
              </p>
            </div>

            <div className="border border-gold-700/40 bg-gold-50/40 px-3 py-2 text-[11.5px] italic text-gold-900">
              ⓘ Transit via le Service du Courrier (règle B14.5). Statut du document&nbsp;:{' '}
              <code className="font-mono text-[11px] not-italic">{currentStatus}</code> →{' '}
              <code className="font-mono text-[11px] not-italic">AWAITING_DG_ANALYSIS</code>.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                disabled={returnPending}
                className="flex-1 border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={returnPending}
                className="flex-1 bg-cmred px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmred-900 disabled:opacity-50"
              >
                {returnPending ? 'Envoi…' : 'Renvoyer au DG →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  // =========================================================================
  //  Menu (default view) — stacked action cards
  // =========================================================================

  return (
    <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
      {/* 1. Prise en charge — always visible */}
      <div
        className={
          'border p-5 transition ' +
          (takeOk
            ? 'border-cmgreen-800 bg-cmgreen-50'
            : 'border-cmgreen-700 bg-white')
        }
      >
        <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
          {takeOk ? '✓ Document en traitement' : '⇒ Prendre en charge'}
        </div>
        <h3 className="serif mt-1 text-[16px] font-bold text-ink">
          {takeOk
            ? 'Ce dossier est désormais sous votre responsabilité'
            : 'Marquer le document en traitement'}
        </h3>
        <p className="serif mt-2 text-[12.5px] italic text-ink-3">
          {takeOk
            ? `Vous êtes le détenteur courant pour ${effectiveRoleLabel}. Vous pouvez maintenant ` +
              `déléguer à une sous-unité ou produire un avis et le renvoyer en haut.`
            : `Bascule le statut ASSIGNED → IN_TREATMENT et enregistre votre nom comme détenteur ` +
              `courant du document pour ${effectiveRoleLabel}. Optionnel — vous pouvez déléguer ` +
              `ou renvoyer sans prendre en charge.`}
        </p>

        {takeError && (
          <div className="mt-3 border border-cmred bg-cmred-50 px-3 py-2 text-[12px] font-medium text-cmred">
            {takeError}
          </div>
        )}

        {!takeOk && (
          <button
            type="button"
            onClick={handleTake}
            disabled={takePending}
            className="mt-4 w-full bg-cmgreen-800 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
          >
            {takePending ? 'Mise à jour…' : 'Marquer en traitement →'}
          </button>
        )}
      </div>

      {/* 2. Déléguer à une sous-unité — B12 (only if children exist) */}
      {canDelegate && (
        <div className="border border-cmgreen-700 bg-white p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
            ⬇ Délégation interne
          </div>
          <h3 className="serif mt-1 text-[16px] font-bold text-ink">
            Déléguer à une sous-unité
          </h3>
          <p className="serif mt-2 text-[12.5px] italic text-ink-3">
            Transférer le dossier à l&apos;un de vos {childrenRoles.length} subordonné
            {childrenRoles.length > 1 ? 's' : ''} direct{childrenRoles.length > 1 ? 's' : ''}
            {' '}dans l&apos;organigramme. Le dossier reste au sein de votre département
            (statut <code className="font-mono text-[11px]">IN_TREATMENT</code>).
          </p>

          {/* Quick preview of who can be picked */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {childrenRoles.slice(0, 4).map((r) => (
              <span
                key={r}
                className="border border-line bg-bgsoft px-2 py-0.5 text-[10.5px] text-ink-2"
                title={roleMeta(r)?.fr}
              >
                {roleMeta(r)?.shortFr ?? r}
              </span>
            ))}
            {childrenRoles.length > 4 && (
              <span className="px-2 py-0.5 text-[10.5px] italic text-ink-4">
                +{childrenRoles.length - 4} autres
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setView('delegating')}
            className="mt-4 w-full bg-cmgreen-800 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900"
          >
            ⬇ Choisir un subordonné…
          </button>
        </div>
      )}

      {/* 3. Renvoyer au supérieur — B12 (only if parent exists and isn't DG) */}
      {canReturnUp && (
        <div className="border border-cmgreen-700 bg-white p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
            ⬆ Renvoi au supérieur
          </div>
          <h3 className="serif mt-1 text-[16px] font-bold text-ink">
            Renvoyer avec avis à {parentMeta?.shortFr ?? '…'}
          </h3>
          <p className="serif mt-2 text-[12.5px] italic text-ink-3">
            Vous avez fini votre part du traitement. Transmettez le dossier à votre supérieur
            hiérarchique direct (<strong>{parentMeta?.fr ?? roleLabel(parentRole!)}</strong>)
            avec votre avis joint comme note interne.
          </p>
          <button
            type="button"
            onClick={() => setView('returning-up')}
            className="mt-4 w-full border border-cmgreen-800 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 transition hover:bg-cmgreen-800 hover:text-white"
          >
            ⬆ Renvoyer avec avis…
          </button>
        </div>
      )}

      {/* 4. Renvoyer au DG (refusal) — always visible */}
      <div className="border border-line bg-white p-5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-3">
          Cette affectation n&apos;est pas pour vous ?
        </div>
        <h3 className="serif mt-1 text-[15px] font-semibold text-ink">
          Renvoyer le document au DG
        </h3>
        <p className="serif mt-2 text-[12.5px] italic text-ink-3">
          Si le DG s&apos;est trompé d&apos;unité ou si vous n&apos;êtes pas compétent pour
          ce dossier (et qu&apos;aucun de vos subordonnés ne l&apos;est non plus), vous
          pouvez le renvoyer avec un motif. Le DG le retrouve dans sa corbeille et peut
          re-dispatcher.
        </p>
        <button
          type="button"
          onClick={() => setView('returning')}
          className="mt-4 w-full border border-cmred bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmred transition hover:bg-cmred hover:text-white"
        >
          ↩ Renvoyer au DG…
        </button>
      </div>

      <p className="text-[10.5px] italic text-ink-4">
        Toutes les actions sont tracées dans l&apos;historique du document. Hiérarchie
        verrouillée par l&apos;organigramme officiel (Résolution 02 juillet 2020).
      </p>
    </div>
  );
}

// ============================================================================
//  SuccessCard — shared success view for the three forms
// ============================================================================

function SuccessCard({
  kind,
  documentReference,
  backHref,
  targetLabel,
}: {
  kind: 'returned-dg' | 'delegated' | 'returned-up';
  documentReference: string;
  backHref: string;
  targetLabel?: string;
}) {
  const content =
    kind === 'returned-dg'
      ? {
          title: '✓ Document renvoyé au DG',
          headline: `${documentReference} retourné via le Service du Courrier`,
          body:
            'Le DG le retrouvera dans sa corbeille (statut AWAITING_DG_ANALYSIS) avec votre ' +
            'motif visible dans les notes du dossier. Il pourra alors le re-dispatcher vers une ' +
            'autre unité.',
        }
      : kind === 'delegated'
      ? {
          title: '✓ Dossier délégué',
          headline: `${documentReference} transmis à ${targetLabel}`,
          body:
            'La sous-unité destinataire le verra dans sa corbeille. Le dossier reste au statut ' +
            'IN_TREATMENT — votre département en garde la responsabilité collective jusqu\'au ' +
            'retour final au DG (B15).',
        }
      : {
          title: '✓ Dossier renvoyé au supérieur',
          headline: `${documentReference} transmis à ${targetLabel}`,
          body:
            'Votre supérieur le verra dans sa corbeille avec votre avis joint comme note interne. ' +
            'Le dossier reste au statut IN_TREATMENT.',
        };

  return (
    <div className="lg:sticky lg:top-6 lg:self-start">
      <div className="border-2 border-cmgreen-800 bg-cmgreen-50 p-5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
          {content.title}
        </div>
        <h3 className="serif mt-2 text-[16px] font-bold text-ink">{content.headline}</h3>
        <p className="serif mt-2 text-[12.5px] italic text-cmgreen-900/80">{content.body}</p>
        <a
          href={backHref}
          className="mt-4 inline-block border border-cmgreen-800 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 hover:bg-cmgreen-800 hover:text-white"
        >
          ← Retour à ma corbeille
        </a>
      </div>
    </div>
  );
}
