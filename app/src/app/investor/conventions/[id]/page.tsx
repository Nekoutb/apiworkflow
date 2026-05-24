import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatFcfaCompact } from '@/lib/fcfa';
import {
  STAGE_LABELS_FR,
  STAGE_ORDER,
  sectorLabel,
  stageIndex,
  statusLabel,
  statusPillClass,
} from '@/lib/stages';
import type { ConventionStage, ConventionStatus, WorkflowAction } from '@prisma/client';

export const metadata = { title: 'Suivi du dossier · Espace Investisseur' };
export const dynamic = 'force-dynamic';

const SLA_DAYS = 10;

export default async function ConventionTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');

  const { id } = await params;

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
    select: { id: true, raisonSociale: true },
  });
  if (!investor) redirect('/investor');

  const cv = await db.convention.findUnique({
    where: { id },
    include: {
      workflowEvents: {
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { name: true, email: true, staffRole: true } },
        },
      },
      _count: { select: { documents: true } },
    },
  });
  if (!cv || cv.investorId !== investor.id) notFound();

  // DRAFT or RETURNED conventions belong on the editing screen.
  if (cv.status === 'DRAFT' || cv.status === 'RETURNED') {
    redirect(`/investor/conventions/${id}/edit`);
  }

  // Per-stage signoff lookup
  const signedStages = new Set<ConventionStage>();
  for (const ev of cv.workflowEvents) {
    if (ev.action === 'SIGNED_OFF') signedStages.add(ev.stage);
  }

  // Per-stage time spent (received → signed_off)
  const timePerStage = computeTimePerStage(cv.workflowEvents);

  const isSigned = cv.status === 'SIGNED' || cv.status === 'CLOSED';
  const awaitingReceipt = cv.status === 'SUBMITTED' && !cv.recepisseAt;

  // SLA chip — only relevant when récépissé delivered and not yet signed
  const slaDaysLeft = cv.recepisseAt && !isSigned
    ? SLA_DAYS - businessDaysSince(cv.recepisseAt)
    : null;

  return (
    <section className="mx-auto max-w-6xl px-7 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
            Dossier {cv.reference} ·{' '}
            {cv.submittedAt ? `soumis le ${formatDateLong(cv.submittedAt)}` : 'soumission en cours'}
          </div>
          <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
            {cv.projectName}
          </h1>
          <p className="serif mt-2 text-[14px] italic text-ink-3">
            {investor.raisonSociale} · {sectorLabel(cv.sector)} · Catégorie {cv.category} ·{' '}
            {formatFcfaCompact(cv.investmentFcfa)} · {cv.jobsPlanned.toLocaleString('fr-FR')} emplois
          </p>
        </div>
        <span className={`pill ${statusPillClass(cv.status)}`}>
          {isSigned
            ? '✓ Signée'
            : awaitingReceipt
              ? 'En attente du récépissé'
              : slaDaysLeft !== null && slaDaysLeft >= 0
                ? `En instruction · J+${SLA_DAYS - slaDaysLeft} / ${SLA_DAYS}`
                : statusLabel(cv.status)}
        </span>
      </div>

      {/* Récépissé status banner */}
      <ReceiptBanner cv={cv} slaDaysLeft={slaDaysLeft} />

      {/* 5-stage editorial stepper */}
      <div className="mt-8 border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-bgsoft px-6 py-3">
          <h2 className="serif text-[17px] font-bold text-ink">Étapes de validation</h2>
          {slaDaysLeft !== null && (
            <SlaBadge daysLeft={slaDaysLeft} />
          )}
        </div>

        <ol className="grid gap-0 px-6 py-7 md:grid-cols-5">
          {STAGE_ORDER.map((s, i) => {
            const done = isSigned || signedStages.has(s);
            const current = !isSigned && !done && s === cv.currentStage && !awaitingReceipt;
            const todo = !done && !current;
            return (
              <li key={s} className="relative px-2">
                {i < STAGE_ORDER.length - 1 && (
                  <span
                    aria-hidden
                    className={
                      'absolute right-0 top-5 hidden h-[2px] w-full md:block ' +
                      (done ? 'bg-cmgreen-700' : 'bg-line-2')
                    }
                  />
                )}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <div
                    className={
                      'mb-3 flex h-10 w-10 items-center justify-center font-display text-[14px] font-bold ' +
                      (done
                        ? 'bg-cmgreen-800 text-white'
                        : current
                          ? 'border-2 border-cmgreen-800 bg-cmgreen-50 italic text-cmgreen-800'
                          : 'border border-line-2 bg-white italic text-ink-4')
                    }
                  >
                    {done ? '✓' : roman(i + 1)}
                  </div>
                  <div className={'text-[11.5px] font-bold uppercase tracking-[0.12em] ' + (current ? 'text-ink' : done ? 'text-ink-2' : 'text-ink-4')}>
                    {STAGE_LABELS_FR[s].replace('Dir. ', '')}
                  </div>
                  <div className="mt-1 text-[10.5px] italic text-ink-3">
                    {done
                      ? timePerStage.get(s)
                        ? `Signé · ${timePerStage.get(s)}`
                        : 'Signé'
                      : current
                        ? 'En cours'
                        : 'À venir'}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Chronologie / timeline */}
      <div className="mt-8 border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line bg-bgsoft px-6 py-3">
          <h2 className="serif text-[17px] font-bold text-ink">Chronologie</h2>
          <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
            {cv.workflowEvents.length} événement{cv.workflowEvents.length > 1 ? 's' : ''}
          </span>
        </div>

        {cv.workflowEvents.length === 0 ? (
          <div className="px-6 py-10 text-center text-[13px] italic text-ink-3">
            Aucun événement consigné.
          </div>
        ) : (
          <ol className="px-6 py-6">
            {cv.workflowEvents.map((ev, idx) => (
              <li
                key={ev.id}
                className={
                  'relative grid grid-cols-[140px_24px_1fr] gap-4 pb-6 ' +
                  (idx === cv.workflowEvents.length - 1 ? '' : 'border-l-0')
                }
              >
                {/* Timeline gutter line */}
                {idx < cv.workflowEvents.length - 1 && (
                  <span aria-hidden className="absolute left-[152px] top-3 h-full w-px bg-line-2" />
                )}
                <div className="text-right">
                  <div className="font-mono text-[12px] font-semibold text-ink-2">
                    {formatTimelineDate(ev.createdAt)}
                  </div>
                  <div className="text-[10.5px] uppercase tracking-[0.14em] text-ink-4">
                    {formatTimelineTime(ev.createdAt)}
                  </div>
                </div>
                <div className="relative flex justify-center">
                  <span
                    className={
                      'mt-1 inline-block h-3 w-3 rounded-full ring-4 ' +
                      eventDotClass(ev.action)
                    }
                  />
                </div>
                <div>
                  <div className="text-[13.5px] font-semibold text-ink">
                    {labelForEvent(ev.action, ev.stage)}
                  </div>
                  {ev.actor && (
                    <div className="mt-0.5 text-[11.5px] italic text-ink-3">
                      par {ev.actor.name ?? ev.actor.email}
                      {ev.actor.staffRole && <> · {actorRoleLabel(ev.actor.staffRole)}</>}
                    </div>
                  )}
                  {ev.comment && (
                    <blockquote className="serif mt-2 border-l-2 border-gold-600 pl-3 text-[12.5px] italic text-ink-2">
                      « {ev.comment} »
                    </blockquote>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Footer actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href="/investor"
          className="border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink"
        >
          ← Mes dossiers
        </Link>
        {isSigned && (
          <>
            <Link
              href={`/investor/conventions/${cv.id}/print`}
              target="_blank"
              className="bg-cmgreen-800 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900"
            >
              📄 Télécharger la convention
            </Link>
            <Link
              href={`/investor/conventions/${cv.id}/obligations`}
              className="border border-cmgreen-700 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 transition hover:bg-cmgreen-50"
            >
              Obligations post-signature →
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

// ============ Sub-components ============

function ReceiptBanner({
  cv,
  slaDaysLeft,
}: {
  cv: { status: ConventionStatus; recepisseAt: Date | null; recepisseNo: string | null; submittedAt: Date | null };
  slaDaysLeft: number | null;
}) {
  if (cv.status === 'SIGNED' || cv.status === 'CLOSED') {
    return null;
  }
  if (!cv.recepisseAt) {
    return (
      <div className="mt-6 flex items-start gap-3 border-l-4 border-gold-600 bg-gold-50/60 px-4 py-3">
        <span className="text-[18px] leading-none text-gold-700">⏳</span>
        <div className="text-[12.5px] leading-relaxed text-ink-2">
          <strong className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-700">
            En attente du récépissé de dépôt
          </strong>
          Le Secrétariat vérifie la conformité de votre dossier. Dès que la vérification sera
          terminée et conforme, vous recevrez un récépissé par email. Le délai légal de 10 jours
          ouvrés commencera à courir à ce moment (Art. 30.3).
        </div>
      </div>
    );
  }
  return (
    <div className="mt-6 flex items-start gap-3 border-l-4 border-cmgreen-700 bg-cmgreen-50 px-4 py-3">
      <span className="text-[18px] leading-none text-cmgreen-800">✓</span>
      <div className="text-[12.5px] leading-relaxed text-ink-2">
        <strong className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800">
          Récépissé délivré
        </strong>
        N° <strong className="font-mono text-ink">{cv.recepisseNo ?? '—'}</strong> · délivré le{' '}
        <strong>{formatDateLong(cv.recepisseAt)}</strong>
        {slaDaysLeft !== null && (
          <>
            {' '}· délai légal{' '}
            <strong className={slaDaysLeft <= 2 ? 'text-cmred' : 'text-ink'}>
              {slaDaysLeft >= 0
                ? `${slaDaysLeft} j ouvré${slaDaysLeft > 1 ? 's' : ''} restant${slaDaysLeft > 1 ? 's' : ''}`
                : `dépassé de ${Math.abs(slaDaysLeft)} j ouvré${Math.abs(slaDaysLeft) > 1 ? 's' : ''}`}
            </strong>
          </>
        )}
      </div>
    </div>
  );
}

function SlaBadge({ daysLeft }: { daysLeft: number }) {
  const ok = daysLeft >= 3;
  const warn = daysLeft >= 0 && daysLeft < 3;
  return (
    <span
      className={
        'inline-block border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] ' +
        (ok
          ? 'border-cmgreen-700 bg-cmgreen-50 text-cmgreen-800'
          : warn
            ? 'border-gold-600 bg-gold-50 text-gold-700'
            : 'border-cmred bg-cmred-50 text-cmred')
      }
    >
      SLA · {daysLeft >= 0 ? `${daysLeft} j restant${daysLeft > 1 ? 's' : ''}` : `dépassé de ${Math.abs(daysLeft)} j`}
    </span>
  );
}

// ============ helpers ============

function labelForEvent(action: WorkflowAction, stage: ConventionStage): string {
  const stageFr = STAGE_LABELS_FR[stage].replace('Dir. ', 'Direction de la ');
  switch (action) {
    case 'RECEIVED':
      return stage === 'SECRETARY' ? 'Dossier soumis en ligne' : `Reçu par ${stageFr}`;
    case 'RECEIPT_ISSUED':
      return 'Récépissé de dépôt délivré';
    case 'SIGNED_OFF':
      return `Signature · ${stageFr}`;
    case 'HANDED_OFF': {
      const idx = STAGE_ORDER.indexOf(stage);
      const next = STAGE_ORDER[idx + 1];
      return next ? `Transmis à ${STAGE_LABELS_FR[next]}` : 'Transmission finale';
    }
    case 'RETURNED':
      return 'Dossier renvoyé à l\'investisseur pour complément';
    case 'REJECTED':
      return `Dossier rejeté à l'étape ${stageFr}`;
  }
}

function eventDotClass(action: WorkflowAction): string {
  switch (action) {
    case 'RECEIVED':       return 'bg-ink-3 ring-bgsoft';
    case 'RECEIPT_ISSUED': return 'bg-gold-600 ring-gold-50';
    case 'SIGNED_OFF':     return 'bg-cmgreen-800 ring-cmgreen-50';
    case 'HANDED_OFF':     return 'bg-cmgreen-700 ring-cmgreen-50';
    case 'RETURNED':       return 'bg-cmred ring-cmred-50';
    case 'REJECTED':       return 'bg-cmred ring-cmred-50';
  }
}

function actorRoleLabel(role: string): string {
  switch (role) {
    case 'SECRETARY':       return 'Secrétariat';
    case 'DIR_INVESTMENTS': return 'Directeur des Investissements';
    case 'DIR_COMPLIANCE':  return 'Directeur de la Conformité';
    case 'DIR_EXTERNAL':    return 'Directeur des Relations Extérieures';
    case 'DG':              return 'Directeur Général';
    case 'ADMIN':           return 'Administrateur';
    default:                return role;
  }
}

function roman(n: number): string {
  return ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x'][n] ?? String(n);
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatTimelineDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function formatTimelineTime(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Naïve business-day counter (Mon-Fri).  Sufficient for build phase. */
function businessDaysSince(start: Date): number {
  const now = new Date();
  if (now <= start) return 0;
  let days = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

type EventLite = { stage: ConventionStage; action: WorkflowAction; createdAt: Date };

function computeTimePerStage(events: EventLite[]): Map<ConventionStage, string> {
  const out = new Map<ConventionStage, string>();
  // Walk newest → oldest, but we want chronological pairs.
  const chrono = [...events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const receivedAt = new Map<ConventionStage, Date>();
  for (const ev of chrono) {
    if (ev.action === 'RECEIVED') {
      receivedAt.set(ev.stage, ev.createdAt);
    }
    if (ev.action === 'SIGNED_OFF') {
      const r = receivedAt.get(ev.stage);
      if (r) out.set(ev.stage, durationLabel(r, ev.createdAt));
    }
  }
  return out;
}

function durationLabel(a: Date, b: Date): string {
  const ms = b.getTime() - a.getTime();
  const h = ms / (1000 * 60 * 60);
  if (h < 1) return `${Math.round(ms / 60000)} min`;
  if (h < 24) return `${Math.round(h)} h`;
  const d = h / 24;
  return d < 10 ? `${d.toFixed(1)} j` : `${Math.round(d)} j`;
}
