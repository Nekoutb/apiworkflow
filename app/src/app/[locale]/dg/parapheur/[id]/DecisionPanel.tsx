'use client';

import { useState, useActionState, useEffect } from 'react';
import { dgDecide, type DgDecideResult } from '@/lib/actions/dg-decide';

const initial: DgDecideResult = {};

export function DecisionPanel({
  documentId,
  documentReference,
  submittedByLabel,
  submittedAt,
}: {
  documentId: string;
  documentReference: string;
  submittedByLabel: string | null;
  submittedAt: string | null;
}) {
  const [state, action, pending] = useActionState(dgDecide, initial);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (state.ok && !done) setDone(true);
  }, [state.ok, done]);

  if (done) {
    const isApproved = state.decision === 'APPROVED';
    const label = isApproved ? 'APPROUVÉ' : 'REJETÉ';
    return (
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div
          className={
            'border-2 p-5 ' +
            (isApproved ? 'border-cmgreen-800 bg-cmgreen-50' : 'border-cmred bg-cmred-50')
          }
        >
          <div
            className={
              'text-[10.5px] font-bold uppercase tracking-[0.18em] ' +
              (isApproved ? 'text-cmgreen-900' : 'text-cmred')
            }
          >
            ✓ Décision rendue · {label}
          </div>
          <h3 className="serif mt-2 text-[16px] font-bold text-ink">
            {documentReference} transmis au Bureau Départ
          </h3>
          <p
            className={
              'serif mt-2 text-[12.5px] italic ' +
              (isApproved ? 'text-cmgreen-900/80' : 'text-cmred-900/80')
            }
          >
            Le dossier est désormais au statut <strong>DECIDED</strong> et apparaît dans la file
            d&apos;expédition du Bureau Départ. Le chef du Bureau Départ composera la lettre de
            réponse (acceptation ou refus) et l&apos;enverra par email à l&apos;émetteur.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="/dg/parapheur"
              className={
                'inline-block border bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] ' +
                (isApproved
                  ? 'border-cmgreen-800 text-cmgreen-800 hover:bg-blue-800 hover:text-white'
                  : 'border-cmred text-cmred hover:bg-cmred hover:text-white')
              }
            >
              ← Retour au parapheur DG
            </a>
            <a
              href="/courrier/depart"
              className={
                'inline-block px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white ' +
                (isApproved ? 'bg-blue-700 hover:bg-blue-800' : 'bg-cmred hover:bg-cmred-900')
              }
            >
              Voir le Bureau Départ →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lg:sticky lg:top-6 lg:self-start">
      <form action={action} className="border-2 border-cmgreen-800 bg-white">
        <div className="border-b border-line bg-cmgreen-50/50 px-4 py-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmgreen-900">
            ⚖ Décision finale du DG
          </div>
          <h3 className="serif mt-0.5 text-[15px] font-semibold text-ink">
            Trancher le dossier
          </h3>
          {submittedByLabel && submittedAt && (
            <p className="mt-1 text-[10.5px] italic text-ink-4">
              Soumis par {submittedByLabel} le{' '}
              {new Date(submittedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}.
              Recommandation visible dans les notes du dossier (colonne de gauche).
            </p>
          )}
        </div>

        <div className="space-y-4 p-5">
          {state.error && (
            <div className="border border-cmred bg-cmred-50 px-3.5 py-2.5 text-[12.5px] font-medium text-cmred">
              {state.error}
            </div>
          )}

          <input type="hidden" name="documentId" value={documentId} />
          <input type="hidden" name="decision" value={decision} />

          <div>
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2">
              Décision <span className="text-cmred">*</span>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setDecision('APPROVED')}
                className={
                  'flex-1 border px-3 py-3 text-[11.5px] font-bold uppercase tracking-[0.14em] transition ' +
                  (decision === 'APPROVED'
                    ? 'border-cmgreen-800 bg-cmgreen-50 text-cmgreen-900'
                    : 'border-line-2 bg-white text-ink-3 hover:border-ink-3')
                }
              >
                ✓ Approuver
              </button>
              <button
                type="button"
                onClick={() => setDecision('REJECTED')}
                className={
                  'flex-1 border px-3 py-3 text-[11.5px] font-bold uppercase tracking-[0.14em] transition ' +
                  (decision === 'REJECTED'
                    ? 'border-cmred bg-cmred-50 text-cmred'
                    : 'border-line-2 bg-white text-ink-3 hover:border-ink-3')
                }
              >
                ✕ Rejeter
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="dg-decide-message"
              className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-2"
            >
              Motivation de la décision <span className="text-cmred">*</span>
            </label>
            <textarea
              id="dg-decide-message"
              name="message"
              rows={7}
              required
              minLength={10}
              maxLength={4000}
              placeholder={
                decision === 'APPROVED'
                  ? 'ex. Dossier complet et conforme à l\'art. 17 de l\'Ordonnance 2025-002. Avis favorable du Directeur de la Promotion et du DGI. Régime d\'incitation accordé sous réserve de la production du certificat de localisation sous 30 jours.'
                  : 'ex. Dossier incomplet : pièces 3, 4 et 7 manquantes. Avis défavorable de la Direction de la Facilitation pour cause de non-conformité à l\'art. 23. Refus motivé à notifier à l\'émetteur.'
              }
              className={
                'w-full border bg-white px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-4 focus:outline-none focus:ring-1 ' +
                (state.fieldErrors?.message
                  ? 'border-cmred focus:border-cmred focus:ring-cmred'
                  : decision === 'APPROVED'
                    ? 'border-line-2 focus:border-cmgreen-800 focus:ring-cmgreen-800'
                    : 'border-line-2 focus:border-cmred focus:ring-cmred')
              }
            />
            {state.fieldErrors?.message && (
              <p className="mt-1 text-[11px] text-cmred">{state.fieldErrors.message}</p>
            )}
            <p className="mt-1 text-[10.5px] italic text-ink-4">
              Devient une note tagguée <code className="font-mono">[Décision DG — {decision === 'APPROVED' ? 'APPROUVÉ' : 'REJETÉ'}]</code>
              {' '}visible par toute la chaîne. Le Bureau Départ s&apos;en sert pour composer la lettre.
            </p>
          </div>

          <div className="border border-cmgreen-800/40 bg-cmgreen-50/50 px-3 py-2 text-[11.5px] italic text-cmgreen-900">
            ⓘ Le dossier transitionne <code className="font-mono not-italic">AWAITING_DG_DECISION</code> →{' '}
            <code className="font-mono not-italic">DECIDED</code>. Il quitte le parapheur DG et
            apparaît dans le Bureau Départ pour expédition.
          </div>

          <button
            type="submit"
            disabled={pending}
            className={
              'w-full px-4 py-3 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition disabled:opacity-50 ' +
              (decision === 'APPROVED' ? 'bg-blue-700 hover:bg-blue-800' : 'bg-cmred hover:bg-cmred-900')
            }
          >
            {pending
              ? 'Enregistrement…'
              : decision === 'APPROVED'
                ? '✓ Confirmer l\'approbation →'
                : '✕ Confirmer le rejet →'}
          </button>
        </div>
      </form>
    </div>
  );
}
