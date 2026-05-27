'use client';

import { useState, useTransition, useActionState, useEffect } from 'react';
import {
  markInTreatment,
  returnToDg,
  delegateDown,
  returnUp,
  requestCoAvis,
  returnCoAvis,
  type ReturnToDgResult,
  type DelegateDownResult,
  type ReturnUpResult,
  type RequestCoAvisResult,
  type ReturnCoAvisResult,
} from '@/lib/actions/unit-corbeille';
import {
  requestExternalAvis,
  recordExternalAvis,
  cancelExternalAvis,
  type RequestExternalAvisResult,
  type RecordExternalAvisResult,
  type CancelExternalAvisResult,
} from '@/lib/actions/external-avis';
import { roleLabel, roleMeta } from '@/lib/roles';
import type { StaffRole, ExternalRecipient, ExternalTransmissionStatus } from '@prisma/client';

const RECIPIENT_OPTIONS: Array<{ value: ExternalRecipient; label: string; freeText: boolean }> = [
  { value: 'MINISTRE_FINANCES',    label: 'Ministère des Finances',                  freeText: false },
  { value: 'MINISTRE_INDUSTRIE',   label: 'Ministère de l\'Industrie',               freeText: false },
  { value: 'DGI',                  label: 'Direction Générale des Impôts (DGI)',     freeText: false },
  { value: 'DGD',                  label: 'Direction Générale des Douanes (DGD)',    freeText: false },
  { value: 'MINISTRE_AUTRE',       label: 'Autre ministère',                          freeText: true  },
  { value: 'ADMINISTRATION_AUTRE', label: 'Autre administration',                     freeText: true  },
];

const RECIPIENT_LABEL: Record<ExternalRecipient, string> = Object.fromEntries(
  RECIPIENT_OPTIONS.map((o) => [o.value, o.label]),
) as Record<ExternalRecipient, string>;

export type ExternalTransmissionView = {
  id: string;
  recipient: ExternalRecipient;
  recipientName: string | null;
  recipientEmail: string | null;
  purpose: string;
  sentAt: string;
  expectedReturnAt: string | null;
  receivedAt: string | null;
  opinionSummary: string | null;
  status: ExternalTransmissionStatus;
  sentByName: string | null;
};

type View =
  | 'menu'
  | 'returning'        // form: Renvoyer au DG (refusal)
  | 'returned'         //   ↳ success
  | 'delegating'       // form: Déléguer à une sous-unité (B12 · VERTICAL_DOWN)
  | 'delegated'        //   ↳ success
  | 'returning-up'     // form: Renvoyer à mon supérieur (B12 · RETURN_UP)
  | 'returned-up'      //   ↳ success
  | 'requesting-coavis'  // form: Demander un co-avis à un pair (B13 · HORIZONTAL out)
  | 'requested-coavis'   //   ↳ success
  | 'returning-coavis'   // form: Renvoyer le co-avis (B13 · HORIZONTAL back)
  | 'returned-coavis'    //   ↳ success
  | 'requesting-external' // form: Demander un avis externe (B14)
  | 'requested-external'  //   ↳ success
  | 'recording-external'  // form: Enregistrer la réponse externe (B14)
  | 'recorded-external'   //   ↳ success
  | 'cancelling-external' // form: Annuler la demande externe (B14)
  | 'cancelled-external'; //   ↳ success

const initialReturn: ReturnToDgResult = {};
const initialDelegate: DelegateDownResult = {};
const initialReturnUp: ReturnUpResult = {};
const initialRequestCoAvis: RequestCoAvisResult = {};
const initialReturnCoAvis: ReturnCoAvisResult = {};
const initialRequestExternal: RequestExternalAvisResult = {};
const initialRecordExternal: RecordExternalAvisResult = {};
const initialCancelExternal: CancelExternalAvisResult = {};

export function UnitActions({
  documentId,
  documentReference,
  currentStatus,
  effectiveRole,
  effectiveRoleLabel,
  childrenRoles,
  parentRole,
  isDirectorLevel,
  peerRoles,
  coAvisReturnTarget,
  externalTransmissions,
}: {
  documentId: string;
  documentReference: string;
  currentStatus: string;
  effectiveRole: StaffRole;
  effectiveRoleLabel: string;
  childrenRoles: StaffRole[];
  parentRole: StaffRole | null;
  isDirectorLevel: boolean;
  peerRoles: StaffRole[];
  coAvisReturnTarget: StaffRole | null;
  externalTransmissions: ExternalTransmissionView[];
}) {
  const [view, setView] = useState<View>('menu');
  const [takeError, setTakeError] = useState<string | null>(null);
  const [takeOk, setTakeOk] = useState<boolean>(currentStatus === 'IN_TREATMENT');
  const [takePending, startTake] = useTransition();

  const [returnState, returnAction, returnPending] = useActionState(returnToDg, initialReturn);
  const [delegateState, delegateAction, delegatePending] = useActionState(delegateDown, initialDelegate);
  const [returnUpState, returnUpAction, returnUpPending] = useActionState(returnUp, initialReturnUp);
  const [reqCoState, reqCoAction, reqCoPending] = useActionState(requestCoAvis, initialRequestCoAvis);
  const [retCoState, retCoAction, retCoPending] = useActionState(returnCoAvis, initialReturnCoAvis);
  const [reqExtState, reqExtAction, reqExtPending] = useActionState(requestExternalAvis, initialRequestExternal);
  const [recExtState, recExtAction, recExtPending] = useActionState(recordExternalAvis, initialRecordExternal);
  const [canExtState, canExtAction, canExtPending] = useActionState(cancelExternalAvis, initialCancelExternal);
  const [recipientChoice, setRecipientChoice] = useState<ExternalRecipient>('MINISTRE_FINANCES');

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
  useEffect(() => {
    if (reqCoState.ok && view !== 'requested-coavis') setView('requested-coavis');
  }, [reqCoState.ok, view]);
  useEffect(() => {
    if (retCoState.ok && view !== 'returned-coavis') setView('returned-coavis');
  }, [retCoState.ok, view]);
  useEffect(() => {
    if (reqExtState.ok && view !== 'requested-external') setView('requested-external');
  }, [reqExtState.ok, view]);
  useEffect(() => {
    if (recExtState.ok && view !== 'recorded-external') setView('recorded-external');
  }, [recExtState.ok, view]);
  useEffect(() => {
    if (canExtState.ok && view !== 'cancelled-external') setView('cancelled-external');
  }, [canExtState.ok, view]);

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
  // B13 — co-avis
  const canRequestCoAvis = isDirectorLevel && peerRoles.length > 0;
  const canReturnCoAvis  = !!coAvisReturnTarget;
  const coAvisOriginMeta = coAvisReturnTarget ? roleMeta(coAvisReturnTarget) : undefined;
  // B14 — external avis
  const pendingExternal = externalTransmissions.find((t) => t.status === 'PENDING');
  const isAwaitingExternal = currentStatus === 'AWAITING_EXTERNAL_AVIS';
  const recipientFreeText = RECIPIENT_OPTIONS.find((o) => o.value === recipientChoice)?.freeText ?? false;

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
  if (view === 'requested-coavis') {
    return (
      <SuccessCard
        kind="requested-coavis"
        documentReference={documentReference}
        backHref="/unit/corbeille"
        targetLabel={reqCoState.targetLabel ?? ''}
      />
    );
  }
  if (view === 'returned-coavis') {
    return (
      <SuccessCard
        kind="returned-coavis"
        documentReference={documentReference}
        backHref="/unit/corbeille"
        targetLabel={retCoState.targetLabel ?? ''}
      />
    );
  }
  if (view === 'requested-external') {
    return (
      <SuccessCard
        kind="requested-external"
        documentReference={documentReference}
        backHref="/unit/corbeille"
        targetLabel={reqExtState.recipientLabel ?? ''}
      />
    );
  }
  if (view === 'recorded-external') {
    return (
      <SuccessCard
        kind="recorded-external"
        documentReference={documentReference}
        backHref="/unit/corbeille"
      />
    );
  }
  if (view === 'cancelled-external') {
    return (
      <SuccessCard
        kind="cancelled-external"
        documentReference={documentReference}
        backHref="/unit/corbeille"
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

  if (view === 'requesting-external') {
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <form action={reqExtAction} className="border border-cmred bg-white">
          <div className="border-b border-line bg-cmred-50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
              ⤴ Avis externe (hors API)
            </div>
            <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
              Solliciter un avis d&apos;une administration externe
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {reqExtState.error && (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
                {reqExtState.error}
              </div>
            )}

            <input type="hidden" name="documentId" value={documentId} />

            <div>
              <label
                htmlFor="recipient"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Destinataire <span className="text-cmred">*</span>
              </label>
              <select
                id="recipient"
                name="recipient"
                required
                value={recipientChoice}
                onChange={(e) => setRecipientChoice(e.target.value as ExternalRecipient)}
                className={
                  'w-full border bg-white px-3.5 py-2.5 text-[13px] text-ink focus:outline-none focus:ring-1 ' +
                  (reqExtState.fieldErrors?.recipient
                    ? 'border-cmred focus:border-cmred focus:ring-cmred'
                    : 'border-line-2 focus:border-cmred focus:ring-cmred')
                }
              >
                {RECIPIENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {reqExtState.fieldErrors?.recipient && (
                <p className="mt-1 text-[11px] text-cmred">{reqExtState.fieldErrors.recipient}</p>
              )}
            </div>

            {recipientFreeText && (
              <div>
                <label
                  htmlFor="recipientName"
                  className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
                >
                  Nom exact de l&apos;administration <span className="text-cmred">*</span>
                </label>
                <input
                  id="recipientName"
                  name="recipientName"
                  type="text"
                  maxLength={200}
                  required
                  placeholder="ex. Ministère de l'Économie · Direction des Stratégies"
                  className={
                    'w-full border bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 ' +
                    (reqExtState.fieldErrors?.recipientName
                      ? 'border-cmred focus:border-cmred focus:ring-cmred'
                      : 'border-line-2 focus:border-cmred focus:ring-cmred')
                  }
                />
                {reqExtState.fieldErrors?.recipientName && (
                  <p className="mt-1 text-[11px] text-cmred">{reqExtState.fieldErrors.recipientName}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="recipientEmail"
                  className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
                >
                  Email (optionnel)
                </label>
                <input
                  id="recipientEmail"
                  name="recipientEmail"
                  type="email"
                  maxLength={200}
                  placeholder="contact@…"
                  className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[12.5px] text-ink placeholder:text-ink-4 focus:border-cmred focus:outline-none focus:ring-1 focus:ring-cmred"
                />
              </div>
              <div>
                <label
                  htmlFor="expectedReturnDays"
                  className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
                >
                  Délai souhaité (jours)
                </label>
                <input
                  id="expectedReturnDays"
                  name="expectedReturnDays"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="14"
                  className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[12.5px] text-ink placeholder:text-ink-4 focus:border-cmred focus:outline-none focus:ring-1 focus:ring-cmred"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="purpose"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Motif de la demande <span className="text-cmred">*</span>
              </label>
              <textarea
                id="purpose"
                name="purpose"
                rows={4}
                required
                minLength={10}
                maxLength={2000}
                placeholder="ex. Avis fiscal sur l'éligibilité au régime d'incitation prévu à l'art. 17 de l'Ordonnance 2025-002."
                className={
                  'w-full border bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 ' +
                  (reqExtState.fieldErrors?.purpose
                    ? 'border-cmred focus:border-cmred focus:ring-cmred'
                    : 'border-line-2 focus:border-cmred focus:ring-cmred')
                }
              />
              {reqExtState.fieldErrors?.purpose && (
                <p className="mt-1 text-[11px] text-cmred">{reqExtState.fieldErrors.purpose}</p>
              )}
            </div>

            <div className="border border-cmred/40 bg-cmred-50/40 px-3 py-2 text-[11.5px] italic text-cmred">
              ⓘ Le document passera au statut <code className="font-mono not-italic">AWAITING_EXTERNAL_AVIS</code>.
              Votre unité reste détentrice — vous pourrez enregistrer la réponse reçue ou annuler
              la demande à tout moment. Toutes les autres actions (déléguer, renvoyer, etc.) sont
              suspendues jusqu&apos;au retour.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                disabled={reqExtPending}
                className="flex-1 border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={reqExtPending}
                className="flex-1 bg-cmred px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmred-900 disabled:opacity-50"
              >
                {reqExtPending ? 'Envoi…' : 'Envoyer la demande →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'recording-external' && pendingExternal) {
    const recipientDisplay = pendingExternal.recipientName?.trim() || RECIPIENT_LABEL[pendingExternal.recipient];
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <form action={recExtAction} className="border border-cmgreen-700 bg-white">
          <div className="border-b border-line bg-cmgreen-50/50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
              ✓ Enregistrer la réponse externe
            </div>
            <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
              Avis reçu de {recipientDisplay}
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {recExtState.error && (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
                {recExtState.error}
              </div>
            )}

            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="transmissionId" value={pendingExternal.id} />

            <div className="border border-line bg-bgsoft px-3 py-2 text-[11.5px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                Demande initiale
              </div>
              <p className="serif mt-1 italic text-ink-2">{pendingExternal.purpose}</p>
              <p className="mt-1 text-[10.5px] text-ink-4">
                Envoyée le {new Date(pendingExternal.sentAt).toLocaleDateString('fr-FR')}
                {pendingExternal.sentByName && ` par ${pendingExternal.sentByName}`}.
              </p>
            </div>

            <div>
              <label
                htmlFor="opinionSummary"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Résumé de l&apos;avis reçu <span className="text-cmred">*</span>
              </label>
              <textarea
                id="opinionSummary"
                name="opinionSummary"
                rows={7}
                required
                minLength={10}
                maxLength={4000}
                placeholder="ex. Avis favorable de la DGI. L'investisseur est éligible au régime d'incitation. Réserve : production du certificat de localisation sous 30 jours."
                className={
                  'w-full border bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 ' +
                  (recExtState.fieldErrors?.opinionSummary
                    ? 'border-cmred focus:border-cmred focus:ring-cmred'
                    : 'border-line-2 focus:border-cmgreen-800 focus:ring-cmgreen-800')
                }
              />
              {recExtState.fieldErrors?.opinionSummary && (
                <p className="mt-1 text-[11px] text-cmred">{recExtState.fieldErrors.opinionSummary}</p>
              )}
              <p className="mt-1 text-[10.5px] italic text-ink-4">
                Recopiez fidèlement l&apos;avis reçu (la pièce papier/PDF originale reste votre
                référence). Le résumé devient une note interne visible par tout le département
                et par le DG.
              </p>
            </div>

            <div className="border border-cmgreen-800/40 bg-cmgreen-50/50 px-3 py-2 text-[11.5px] italic text-cmgreen-900">
              ⓘ Le document repasse au statut <code className="font-mono not-italic">IN_TREATMENT</code>
              {' '}— vous pouvez reprendre le traitement normal (déléguer, renvoyer, etc.).
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                disabled={recExtPending}
                className="flex-1 border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={recExtPending}
                className="flex-1 bg-cmgreen-800 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
              >
                {recExtPending ? 'Enregistrement…' : 'Enregistrer l\'avis →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'cancelling-external' && pendingExternal) {
    const recipientDisplay = pendingExternal.recipientName?.trim() || RECIPIENT_LABEL[pendingExternal.recipient];
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <form action={canExtAction} className="border border-cmred bg-white">
          <div className="border-b border-line bg-cmred-50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
              ✕ Annuler la demande externe
            </div>
            <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
              Retirer la demande envoyée à {recipientDisplay}
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {canExtState.error && (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
                {canExtState.error}
              </div>
            )}

            <input type="hidden" name="documentId" value={documentId} />
            <input type="hidden" name="transmissionId" value={pendingExternal.id} />

            <div>
              <label
                htmlFor="cancel-reason"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Motif d&apos;annulation (optionnel)
              </label>
              <textarea
                id="cancel-reason"
                name="reason"
                rows={3}
                maxLength={2000}
                placeholder="ex. Aucune réponse après 30 jours · le traitement reprend sans l'avis externe."
                className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:border-cmred focus:outline-none focus:ring-1 focus:ring-cmred"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                disabled={canExtPending}
                className="flex-1 border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Garder en attente
              </button>
              <button
                type="submit"
                disabled={canExtPending}
                className="flex-1 bg-cmred px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmred-900 disabled:opacity-50"
              >
                {canExtPending ? 'Annulation…' : 'Annuler la demande →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'requesting-coavis') {
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <form action={reqCoAction} className="border border-gold-700 bg-white">
          <div className="border-b border-line bg-gold-50/50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
              ↔ Demande de co-avis (HORIZONTAL)
            </div>
            <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
              Solliciter l&apos;avis d&apos;un Directeur pair
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {reqCoState.error && (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
                {reqCoState.error}
              </div>
            )}

            <input type="hidden" name="documentId" value={documentId} />

            <div>
              <label
                htmlFor="targetRole-coavis"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Directeur pair (rattaché au DG) <span className="text-cmred">*</span>
              </label>
              <select
                id="targetRole-coavis"
                name="targetRole"
                required
                defaultValue={peerRoles[0]}
                className={
                  'w-full border bg-white px-3.5 py-2.5 text-[13px] text-ink focus:outline-none focus:ring-1 ' +
                  (reqCoState.fieldErrors?.targetRole
                    ? 'border-cmred focus:border-cmred focus:ring-cmred'
                    : 'border-line-2 focus:border-gold-700 focus:ring-gold-700')
                }
              >
                {peerRoles.map((r) => {
                  const meta = roleMeta(r);
                  return (
                    <option key={r} value={r}>
                      {meta?.shortFr ?? r} · {meta?.fr ?? roleLabel(r)}
                      {meta?.article && meta.article !== '—' ? ` (${meta.article})` : ''}
                    </option>
                  );
                })}
              </select>
              {reqCoState.fieldErrors?.targetRole && (
                <p className="mt-1 text-[11px] text-cmred">{reqCoState.fieldErrors.targetRole}</p>
              )}
              <p className="mt-1 text-[10.5px] italic text-ink-4">
                {peerRoles.length} pair{peerRoles.length > 1 ? 's' : ''} disponible
                {peerRoles.length > 1 ? 's' : ''} — uniquement les rôles rattachés directement
                au DG (Directeurs, Sous-directeurs rattachés, Chefs de Division).
              </p>
            </div>

            <div>
              <label
                htmlFor="message-coavis"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Objet du co-avis (recommandé)
              </label>
              <textarea
                id="message-coavis"
                name="message"
                rows={4}
                maxLength={2000}
                placeholder="ex. Avis juridique requis sur la clause d'agrément · délai souhaité 5 jours."
                className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:border-gold-700 focus:outline-none focus:ring-1 focus:ring-gold-700"
              />
              <p className="mt-1 text-[10.5px] italic text-ink-4">
                Précisez ce que vous attendez du pair (avis juridique, technique, opérationnel,
                délai souhaité, etc.).
              </p>
            </div>

            <div className="border border-gold-700/40 bg-gold-50/40 px-3 py-2 text-[11.5px] italic text-gold-900">
              ⓘ Le dossier passe en main au pair (statut <code className="font-mono not-italic">IN_TREATMENT</code>
              maintenu). Il pourra le traiter dans sa propre chaîne hiérarchique puis vous
              le renverra avec son co-avis attaché.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                disabled={reqCoPending}
                className="flex-1 border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={reqCoPending}
                className="flex-1 bg-gold-700 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-gold-800 disabled:opacity-50"
              >
                {reqCoPending ? 'Envoi…' : 'Demander le co-avis →'}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'returning-coavis') {
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <form action={retCoAction} className="border border-gold-700 bg-white">
          <div className="border-b border-line bg-gold-50/50 px-4 py-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
              ↔ Retour de co-avis (HORIZONTAL)
            </div>
            <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
              Renvoyer votre avis à {coAvisOriginMeta?.fr ?? roleLabel(coAvisReturnTarget!)}
            </h3>
          </div>

          <div className="space-y-4 p-5">
            {retCoState.error && (
              <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
                {retCoState.error}
              </div>
            )}

            <input type="hidden" name="documentId" value={documentId} />

            <div>
              <label
                htmlFor="message-retco"
                className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
              >
                Votre co-avis (recommandé)
              </label>
              <textarea
                id="message-retco"
                name="message"
                rows={6}
                maxLength={2000}
                placeholder="ex. Avis favorable du point de vue juridique. La clause d'agrément est conforme à l'art. 23 de l'Ordonnance. Réserve : vérifier la conformité fiscale auprès de la DGI."
                className="w-full border border-line-2 bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:border-gold-700 focus:outline-none focus:ring-1 focus:ring-gold-700"
              />
              <p className="mt-1 text-[10.5px] italic text-ink-4">
                Devient une note interne tagguée <code className="font-mono">[Co-avis]</code>,
                visible par le Directeur qui vous a sollicité.
              </p>
            </div>

            <div className="border border-gold-700/40 bg-gold-50/50 px-3 py-2 text-[11.5px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-700">
                Retour à
              </div>
              <div className="mt-0.5 font-bold text-gold-900">
                {coAvisOriginMeta?.fr ?? roleLabel(coAvisReturnTarget!)}
              </div>
              <div className="mt-0.5 font-mono text-[10.5px] text-gold-900/70">
                {coAvisReturnTarget}
                {coAvisOriginMeta?.article && coAvisOriginMeta.article !== '—' ? ` · ${coAvisOriginMeta.article}` : ''}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setView('menu')}
                disabled={retCoPending}
                className="flex-1 border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={retCoPending}
                className="flex-1 bg-gold-700 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-gold-800 disabled:opacity-50"
              >
                {retCoPending ? 'Envoi…' : `Renvoyer à ${coAvisOriginMeta?.shortFr ?? '…'} →`}
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
  //  AWAITING_EXTERNAL_AVIS — dedicated waiting state (B14)
  //  All other actions are suspended until the response is recorded or the
  //  request is cancelled.
  // =========================================================================

  if (isAwaitingExternal && pendingExternal) {
    const recipientDisplay = pendingExternal.recipientName?.trim() || RECIPIENT_LABEL[pendingExternal.recipient];
    const sentDate = new Date(pendingExternal.sentAt);
    const expectedDate = pendingExternal.expectedReturnAt ? new Date(pendingExternal.expectedReturnAt) : null;
    const overdue = expectedDate && expectedDate.getTime() < Date.now();
    const daysSent = Math.floor((Date.now() - sentDate.getTime()) / (24 * 60 * 60 * 1000));

    return (
      <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
        <div className="border-2 border-cmred bg-cmred-50 p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
            ⏳ Avis externe en attente
          </div>
          <h3 className="serif mt-1 text-[16px] font-bold text-ink">
            En attente d&apos;une réponse de {recipientDisplay}
          </h3>

          <div className="mt-3 space-y-2 border-l-2 border-cmred/40 pl-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-cmred/70">
                Motif envoyé
              </div>
              <p className="serif mt-0.5 text-[12.5px] italic text-ink-2">
                {pendingExternal.purpose}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              <span className="text-ink-3">
                Envoyé : <strong className="font-semibold text-ink-2">
                  {sentDate.toLocaleDateString('fr-FR')}
                </strong>
                {' '}(il y a {daysSent} jour{daysSent > 1 ? 's' : ''})
              </span>
              {expectedDate && (
                <span className={overdue ? 'font-bold text-cmred' : 'text-ink-3'}>
                  Retour attendu : <strong className="font-semibold">
                    {expectedDate.toLocaleDateString('fr-FR')}
                  </strong>
                  {overdue && ' ⚠ dépassé'}
                </span>
              )}
              {pendingExternal.sentByName && (
                <span className="text-ink-4">par {pendingExternal.sentByName}</span>
              )}
            </div>
            {pendingExternal.recipientEmail && (
              <div className="text-[11px] text-ink-3">
                Email : <code className="font-mono text-[10.5px]">{pendingExternal.recipientEmail}</code>
              </div>
            )}
          </div>

          <p className="serif mt-3 text-[12px] italic text-cmred-900/80">
            Toutes les autres actions sont suspendues. Enregistrez la réponse lorsqu&apos;elle
            arrive, ou annulez la demande si vous décidez de poursuivre sans cet avis.
          </p>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              onClick={() => setView('recording-external')}
              className="w-full bg-cmgreen-800 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900"
            >
              ✓ Enregistrer la réponse reçue →
            </button>
            <button
              type="button"
              onClick={() => setView('cancelling-external')}
              className="w-full border border-cmred bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmred transition hover:bg-cmred hover:text-white"
            >
              ✕ Annuler la demande…
            </button>
          </div>
        </div>

        <p className="text-[10.5px] italic text-ink-4">
          L&apos;historique d&apos;avis externes (passés et en cours) reste consultable dans la
          colonne de gauche. Toutes les actions sont tracées.
        </p>
      </div>
    );
  }

  // =========================================================================
  //  Menu (default view) — stacked action cards
  // =========================================================================

  return (
    <div className="lg:sticky lg:top-6 lg:self-start space-y-4">
      {/* 0. Co-avis return (B13) — TOP priority when applicable.
            Renders a strong call-to-action since this dossier is on loan
            from a peer Directeur and they're waiting for our opinion. */}
      {canReturnCoAvis && (
        <div className="border-2 border-gold-700 bg-gold-50/50 p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            ⚠ Co-avis en attente · à retourner
          </div>
          <h3 className="serif mt-1 text-[16px] font-bold text-ink">
            Renvoyer votre co-avis à {coAvisOriginMeta?.shortFr ?? '…'}
          </h3>
          <p className="serif mt-2 text-[12.5px] italic text-ink-3">
            Ce dossier vous a été transmis pour co-avis par{' '}
            <strong>{coAvisOriginMeta?.fr ?? roleLabel(coAvisReturnTarget!)}</strong>. Une fois
            votre avis formé (au besoin via délégation interne ↓ vers vos sous-unités),
            renvoyez-le.
          </p>
          <button
            type="button"
            onClick={() => setView('returning-coavis')}
            className="mt-4 w-full bg-gold-700 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-gold-800"
          >
            ↔ Renvoyer le co-avis…
          </button>
        </div>
      )}

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

      {/* 3.5 Demander un co-avis — B13 (only for Directeur-level peers with ≥1 peer) */}
      {canRequestCoAvis && (
        <div className="border border-gold-700 bg-white p-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
            ↔ Co-avis horizontal
          </div>
          <h3 className="serif mt-1 text-[16px] font-bold text-ink">
            Demander un avis à un Directeur pair
          </h3>
          <p className="serif mt-2 text-[12.5px] italic text-ink-3">
            Solliciter l&apos;avis d&apos;un autre rôle rattaché au DG (sans repasser par le DG).
            Le pair pourra produire son avis dans sa propre chaîne et vous le renverra ensuite.
          </p>

          {/* Quick preview of who can be picked */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {peerRoles.slice(0, 4).map((r) => (
              <span
                key={r}
                className="border border-line bg-bgsoft px-2 py-0.5 text-[10.5px] text-ink-2"
                title={roleMeta(r)?.fr}
              >
                {roleMeta(r)?.shortFr ?? r}
              </span>
            ))}
            {peerRoles.length > 4 && (
              <span className="px-2 py-0.5 text-[10.5px] italic text-ink-4">
                +{peerRoles.length - 4} autres
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setView('requesting-coavis')}
            className="mt-4 w-full border border-gold-700 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-gold-700 transition hover:bg-gold-700 hover:text-white"
          >
            ↔ Choisir un pair Directeur…
          </button>
        </div>
      )}

      {/* 3.7 Demander un avis externe — B14 (always available in IN_TREATMENT/ASSIGNED) */}
      <div className="border border-cmred bg-white p-5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
          ⤴ Avis externe (hors API)
        </div>
        <h3 className="serif mt-1 text-[16px] font-bold text-ink">
          Demander un avis à une administration externe
        </h3>
        <p className="serif mt-2 text-[12.5px] italic text-ink-3">
          Solliciter l&apos;avis du Ministère des Finances, de la DGI, de la DGD, ou
          d&apos;une autre administration. Le document passe en attente jusqu&apos;à
          réception de la réponse.
        </p>

        {/* Show past transmissions count if any */}
        {externalTransmissions.length > 0 && (
          <div className="mt-3 text-[10.5px] italic text-ink-4">
            ⓘ {externalTransmissions.length} demande{externalTransmissions.length > 1 ? 's' : ''} externe
            {externalTransmissions.length > 1 ? 's' : ''} déjà effectuée
            {externalTransmissions.length > 1 ? 's' : ''} sur ce dossier
            {externalTransmissions.filter((t) => t.status === 'RESPONSE_RECEIVED').length > 0 &&
              ` · ${externalTransmissions.filter((t) => t.status === 'RESPONSE_RECEIVED').length} réponse(s) reçue(s)`}
            .
          </div>
        )}

        <button
          type="button"
          onClick={() => setView('requesting-external')}
          className="mt-4 w-full border border-cmred bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmred transition hover:bg-cmred hover:text-white"
        >
          ⤴ Préparer la demande…
        </button>
      </div>

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
  kind:
    | 'returned-dg'
    | 'delegated'
    | 'returned-up'
    | 'requested-coavis'
    | 'returned-coavis'
    | 'requested-external'
    | 'recorded-external'
    | 'cancelled-external';
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
      : kind === 'returned-up'
      ? {
          title: '✓ Dossier renvoyé au supérieur',
          headline: `${documentReference} transmis à ${targetLabel}`,
          body:
            'Votre supérieur le verra dans sa corbeille avec votre avis joint comme note interne. ' +
            'Le dossier reste au statut IN_TREATMENT.',
        }
      : kind === 'requested-coavis'
      ? {
          title: '✓ Co-avis demandé',
          headline: `${documentReference} transmis à ${targetLabel} pour avis`,
          body:
            'Le pair Directeur a maintenant le dossier en main. Il pourra le traiter dans sa ' +
            'propre chaîne hiérarchique puis vous le renverra avec son co-avis attaché. Vous ' +
            'le verrez réapparaître dans votre corbeille dès le retour.',
        }
      : kind === 'returned-coavis'
      ? {
          title: '✓ Co-avis retourné',
          headline: `${documentReference} renvoyé à ${targetLabel}`,
          body:
            'Le Directeur qui vous avait sollicité retrouve le dossier dans sa corbeille avec ' +
            'votre co-avis joint comme note interne taggée. Le dossier reste au statut ' +
            'IN_TREATMENT — il poursuit son cycle dans le département d\'origine.',
        }
      : kind === 'requested-external'
      ? {
          title: '✓ Avis externe demandé',
          headline: `${documentReference} en attente d'avis de ${targetLabel}`,
          body:
            'Le document est désormais au statut AWAITING_EXTERNAL_AVIS. Toutes les autres ' +
            'actions sont suspendues. Lorsque la réponse arrivera (par courrier, email ou fax), ' +
            'revenez sur cette page pour l\'enregistrer — le document repassera alors en traitement.',
        }
      : kind === 'recorded-external'
      ? {
          title: '✓ Avis externe enregistré',
          headline: `${documentReference} reprend son traitement`,
          body:
            'L\'avis externe a été ajouté aux notes du dossier et est visible par tout le ' +
            'département et le DG. Le document est repassé au statut IN_TREATMENT — vous pouvez ' +
            'reprendre la chaîne normale (déléguer, renvoyer, etc.).',
        }
      : {
          title: '✓ Demande externe annulée',
          headline: `${documentReference} reprend son traitement`,
          body:
            'La demande d\'avis externe a été annulée et marquée comme telle dans les notes. ' +
            'Le document est repassé au statut IN_TREATMENT — vous pouvez poursuivre le ' +
            'traitement sans cet avis.',
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
