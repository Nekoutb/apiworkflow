'use client';

import { useState, useTransition } from 'react';
import {
  handoffStageAction,
  issueRecepisseAction,
  returnToInvestorAction,
  signoffStageAction,
} from '@/lib/actions/staff-workflow';

export type ActionContext = {
  conventionId: string;
  isSecretary: boolean;
  hasRecepisse: boolean;
  allDocsAccepted: boolean;
  hasRejectedDocs: boolean;
  isSignedOff: boolean;
  nextStageLabel: string | null;
  canAct: boolean;
};

export function ActionRail({ ctx }: { ctx: ActionContext }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [signoffComment, setSignoffComment] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const run = (fn: () => Promise<unknown>) => {
    setError(null);
    startTransition(async () => {
      try { await fn(); }
      catch (e) { setError((e as Error).message); }
    });
  };

  const issueReceipt = () => {
    const fd = new FormData();
    fd.set('conventionId', ctx.conventionId);
    run(() => issueRecepisseAction(fd));
  };
  const signOff = () => {
    const fd = new FormData();
    fd.set('conventionId', ctx.conventionId);
    if (signoffComment.trim()) fd.set('comment', signoffComment.trim());
    run(() => signoffStageAction(fd));
  };
  const handOff = () => {
    const fd = new FormData();
    fd.set('conventionId', ctx.conventionId);
    run(() => handoffStageAction(fd));
  };
  const returnDossier = () => {
    if (returnReason.trim().length < 5) {
      setError('Motif requis (5 caractères min).');
      return;
    }
    const fd = new FormData();
    fd.set('conventionId', ctx.conventionId);
    fd.set('reason', returnReason.trim());
    run(() => returnToInvestorAction(fd));
  };

  if (!ctx.canAct) {
    return (
      <div className="border border-line bg-white p-5 text-[12.5px] italic text-ink-3">
        Lecture seule — cette étape n&apos;est pas sous votre responsabilité.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="border border-cmred bg-cmred-50 px-3 py-2 text-[12px] font-medium text-cmred">
          {error}
        </div>
      )}

      {/* Secretariat-specific: issue récépissé */}
      {ctx.isSecretary && !ctx.hasRecepisse && (
        <Card title="Étape 1 · Délivrer le récépissé">
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Une fois les 6 pièces obligatoires acceptées, délivrez le récépissé de dépôt.
            L&apos;investisseur recevra un email automatique et le délai légal de 10 jours ouvrés démarrera.
          </p>
          <button
            type="button"
            onClick={issueReceipt}
            disabled={pending || !ctx.allDocsAccepted}
            title={!ctx.allDocsAccepted ? 'Toutes les pièces doivent être acceptées' : undefined}
            className="mt-4 w-full bg-cmgreen-800 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
          >
            {pending ? 'Délivrance…' : 'Délivrer le récépissé →'}
          </button>
          {!ctx.allDocsAccepted && (
            <p className="mt-2 text-[11px] italic text-ink-3">
              {ctx.hasRejectedDocs
                ? 'Au moins une pièce est rejetée — renvoyer le dossier ou demander à l\'investisseur de retransmettre.'
                : 'Acceptez les pièces restantes pour activer ce bouton.'}
            </p>
          )}
        </Card>
      )}

      {/* Signoff */}
      {(!ctx.isSecretary || ctx.hasRecepisse) && !ctx.isSignedOff && (
        <Card title={ctx.isSecretary ? 'Étape 2 · Signer l\'instruction' : 'Signer l\'instruction'}>
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Marque la fin de votre examen. Vous pourrez ensuite transmettre au stade suivant.
          </p>
          <textarea
            rows={3}
            value={signoffComment}
            onChange={(e) => setSignoffComment(e.target.value)}
            placeholder="Commentaire de signoff (optionnel)…"
            className="mt-3 w-full border border-line-2 bg-white px-3 py-2 text-[12.5px] text-ink focus:border-cmgreen-800 focus:outline-none focus:ring-1 focus:ring-cmgreen-800"
          />
          <button
            type="button"
            onClick={signOff}
            disabled={pending}
            className="mt-3 w-full bg-cmgreen-800 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900 disabled:opacity-50"
          >
            {pending ? 'Signature…' : '✓ Signer l\'étape'}
          </button>
        </Card>
      )}

      {/* Handoff */}
      {ctx.isSignedOff && (
        <Card title={ctx.nextStageLabel ? `Transmettre à ${ctx.nextStageLabel}` : 'Transmission finale'}>
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            {ctx.nextStageLabel
              ? `Le dossier sortira de votre corbeille et apparaîtra immédiatement dans celle de ${ctx.nextStageLabel}.`
              : 'Étape finale du workflow.'}
          </p>
          <button
            type="button"
            onClick={handOff}
            disabled={pending}
            className="mt-3 w-full bg-gold-600 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-obsidian transition hover:bg-gold-500 disabled:opacity-50"
          >
            {pending ? 'Transmission…' : `Transmettre →`}
          </button>
        </Card>
      )}

      {/* Return to investor */}
      {!ctx.isSignedOff && (
        <Card title="Renvoyer à l'investisseur" tone="warn">
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Utilisez cette action si le dossier nécessite une correction côté investisseur (au-delà du rejet de pièces).
          </p>
          {!returnOpen ? (
            <button
              type="button"
              onClick={() => { setReturnOpen(true); setError(null); }}
              disabled={pending}
              className="mt-3 w-full border border-cmred bg-white py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmred transition hover:bg-cmred-50 disabled:opacity-50"
            >
              ↶ Renvoyer le dossier…
            </button>
          ) : (
            <>
              <textarea
                rows={3}
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Motif clair pour l'investisseur (sera envoyé par email)."
                className="mt-3 w-full border border-line-2 bg-white px-3 py-2 text-[12.5px] text-ink focus:border-cmred focus:outline-none focus:ring-1 focus:ring-cmred"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setReturnOpen(false); setReturnReason(''); setError(null); }}
                  className="flex-1 border border-line-2 bg-white py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3 hover:text-ink"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={returnDossier}
                  disabled={pending}
                  className="flex-1 bg-cmred py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? '…' : 'Confirmer le renvoi'}
                </button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

function Card({ title, tone, children }: { title: string; tone?: 'warn'; children: React.ReactNode }) {
  return (
    <div className={
      'border bg-white p-5 ' +
      (tone === 'warn' ? 'border-cmred/40' : 'border-line')
    }>
      <h3 className="serif text-[15px] font-bold text-ink">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}
