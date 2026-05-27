'use client';

import { useState, useTransition, useActionState } from 'react';
import {
  markInTreatment,
  returnToDg,
  type ReturnToDgResult,
} from '@/lib/actions/unit-corbeille';

const initialReturn: ReturnToDgResult = {};

export function UnitActions({
  documentId,
  documentReference,
  currentStatus,
  effectiveRoleLabel,
}: {
  documentId: string;
  documentReference: string;
  currentStatus: string;
  effectiveRoleLabel: string;
}) {
  const [view, setView] = useState<'menu' | 'returning' | 'returned'>('menu');
  const [takeError, setTakeError] = useState<string | null>(null);
  const [takeOk, setTakeOk] = useState<boolean>(currentStatus === 'IN_TREATMENT');
  const [takePending, startTake] = useTransition();

  const [returnState, returnAction, returnPending] = useActionState(returnToDg, initialReturn);

  // Detect successful return — flip to 'returned' view
  if (returnState.ok && view !== 'returned') {
    setView('returned');
  }

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

  // -----------------------------------------------------------------------
  // After return — success view
  // -----------------------------------------------------------------------

  if (view === 'returned') {
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="border-2 border-cmgreen-800 bg-cmgreen-50 p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
            ✓ Document renvoyé au DG
          </div>
          <h3 className="serif mt-2 text-[16px] font-bold text-ink">
            {documentReference} retourné via le Service du Courrier
          </h3>
          <p className="serif mt-2 text-[12.5px] italic text-cmgreen-900/80">
            Le DG le retrouvera dans sa corbeille (statut <strong>AWAITING_DG_ANALYSIS</strong>)
            avec votre motif visible dans les notes du dossier. Il pourra alors le re-dispatcher
            vers une autre unité.
          </p>
          <a
            href="/unit/corbeille"
            className="mt-4 inline-block border border-cmgreen-800 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 hover:bg-cmgreen-800 hover:text-white"
          >
            ← Retour à ma corbeille
          </a>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Return form
  // -----------------------------------------------------------------------

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

  // -----------------------------------------------------------------------
  // Menu (default view) — Take + Return
  // -----------------------------------------------------------------------

  return (
    <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
      {/* Prise en charge */}
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
            ? `Vous êtes le détenteur courant pour ${effectiveRoleLabel}. ` +
              `La suite du workflow (avis, brouillon, renvoi au DG après traitement) ` +
              `arrive dans les phases B12-B15.`
            : `Bascule le statut ASSIGNED → IN_TREATMENT et enregistre votre nom comme détenteur ` +
              `courant du document pour ${effectiveRoleLabel}.`}
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

      {/* Renvoyer au DG */}
      <div className="border border-line bg-white p-5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-3">
          Cette affectation n&apos;est pas pour vous ?
        </div>
        <h3 className="serif mt-1 text-[15px] font-semibold text-ink">
          Renvoyer le document au DG
        </h3>
        <p className="serif mt-2 text-[12.5px] italic text-ink-3">
          Si le DG s&apos;est trompé d&apos;unité ou si vous n&apos;êtes pas compétent pour
          ce dossier, vous pouvez le renvoyer avec un motif. Le DG le retrouve dans sa corbeille
          et peut re-dispatcher.
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
        Toutes les actions sont tracées dans l&apos;historique du document. Transit via le
        Service du Courrier (règle B14.5).
      </p>
    </div>
  );
}
