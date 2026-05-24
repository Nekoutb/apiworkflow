import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatFcfaCompact } from '@/lib/fcfa';
import { sectorLabel, stageLabel, statusLabel, statusPillClass, STAGE_LABELS_FR, STAGE_ORDER } from '@/lib/stages';
import { isStaffRole, roleLabel } from '@/lib/roles';
import { canActOnStage, nextStage } from '@/lib/staff-permissions';
import { REQUIRED_DOCS } from '@/lib/required-documents';
import { isClaudeConfigured } from '@/lib/claude';
import { DocumentTile, type DocumentTileData } from './DocumentTile';
import { ActionRail, type ActionContext } from './ActionRail';
import { AiPane, type AiAnalysisItem } from './AiPane';
import type { StaffRole, WorkflowAction } from '@prisma/client';

export const metadata = { title: 'Dossier · Workflow d\'agrément' };
export const dynamic = 'force-dynamic';

export default async function StaffConventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=staff');
  if (!isStaffRole(session.user.role)) redirect('/');
  const role = session.user.role as StaffRole;

  const { id } = await params;

  const cv = await db.convention.findUnique({
    where: { id },
    include: {
      investor: {
        select: {
          raisonSociale: true, niu: true, contactName: true, contactPhone: true, city: true, region: true,
          user: { select: { email: true } },
        },
      },
      documents: { orderBy: { uploadedAt: 'asc' } },
      workflowEvents: {
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { actor: { select: { name: true, staffRole: true } } },
      },
      aiAnalyses: { orderBy: { generatedAt: 'desc' }, take: 30 },
    },
  });
  if (!cv) notFound();

  // Map verifier user IDs -> names so DocumentTile can show "Validée par X".
  const verifierIds = Array.from(new Set(cv.documents.map((d) => d.verifiedByUserId).filter(Boolean) as string[]));
  const verifiers = verifierIds.length
    ? await db.user.findMany({ where: { id: { in: verifierIds } }, select: { id: true, name: true } })
    : [];
  const verifierName = new Map(verifiers.map((v) => [v.id, v.name ?? '—']));

  const canAct = canActOnStage(role, cv.currentStage) && cv.status === 'SUBMITTED';

  // Build the doc tiles, one per required slot (incl. missing ones)
  const docByKind = new Map(cv.documents.map((d) => [d.kind, d]));
  const tiles: { tile: DocumentTileData | null; slot: typeof REQUIRED_DOCS[number] }[] = REQUIRED_DOCS.map((slot) => {
    const d = docByKind.get(slot.kind);
    if (!d) return { slot, tile: null };
    return {
      slot,
      tile: {
        id: d.id, kind: d.kind, title: slot.title, article: slot.article,
        fileName: d.fileName, sizeBytes: d.sizeBytes, uploadedAt: d.uploadedAt.toISOString(),
        verification: d.verification, rejectionReason: d.rejectionReason,
        verifiedAt: d.verifiedAt?.toISOString() ?? null,
        verifiedByName: d.verifiedByUserId ? (verifierName.get(d.verifiedByUserId) ?? null) : null,
      },
    };
  });

  // Counters
  const accepted = cv.documents.filter((d) => d.verification === 'ACCEPTED').length;
  const rejected = cv.documents.filter((d) => d.verification === 'REJECTED').length;
  const allRequiredAccepted = REQUIRED_DOCS.every((s) => docByKind.get(s.kind)?.verification === 'ACCEPTED');

  // Has the current user (or anyone) signed off this stage already?
  const signedOff = cv.workflowEvents.find((e) => e.action === 'SIGNED_OFF' && e.stage === cv.currentStage);

  const nextStg = nextStage(cv.currentStage);
  const actionCtx: ActionContext = {
    conventionId: cv.id,
    isSecretary: cv.currentStage === 'SECRETARY',
    hasRecepisse: !!cv.recepisseAt,
    allDocsAccepted: allRequiredAccepted,
    hasRejectedDocs: rejected > 0,
    isSignedOff: !!signedOff,
    nextStageLabel: nextStg ? STAGE_LABELS_FR[nextStg] : null,
    canAct,
  };

  return (
    <section className="px-8 py-8">
      {/* Breadcrumb */}
      <div className="mb-3 text-[11px] uppercase tracking-[0.16em] text-ink-3">
        <Link href="/staff/inbox" className="hover:text-ink">← Ma corbeille</Link>
      </div>

      {/* Header */}
      <div className="border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[12px] font-bold text-ink-2">{cv.reference}</span>
              <span className={`pill ${statusPillClass(cv.status)}`}>{statusLabel(cv.status)}</span>
              {cv.recepisseAt && (
                <span className="inline-block border border-cmgreen-700 bg-cmgreen-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-cmgreen-800">
                  Récépissé {cv.recepisseNo}
                </span>
              )}
              {!cv.recepisseAt && cv.currentStage === 'SECRETARY' && cv.status === 'SUBMITTED' && (
                <span className="inline-block border border-gold-600 bg-gold-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-gold-700">
                  Récépissé à délivrer
                </span>
              )}
            </div>
            <h1 className="serif mt-2 text-[28px] font-semibold leading-tight tracking-[-0.3px] text-ink">
              {cv.projectName}
            </h1>
            <div className="mt-1 text-[13px] italic text-ink-3">
              {cv.investor.raisonSociale}
              {cv.investor.niu && <span className="ml-2 font-mono text-[11px] not-italic text-ink-4">{cv.investor.niu}</span>}
              {cv.investor.user.email && <span className="ml-2 not-italic text-ink-4">· {cv.investor.user.email}</span>}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-4">
            <Meta label="Secteur"     value={sectorLabel(cv.sector)} />
            <Meta label="Catégorie"   value={cv.category} />
            <Meta label="Investissement" value={formatFcfaCompact(cv.investmentFcfa)} mono />
            <Meta label="Emplois"     value={cv.jobsPlanned.toLocaleString('fr-FR')} mono />
          </dl>
        </div>

        {/* Stage strip */}
        <div className="mt-5 border-t border-line pt-4">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
            Étape actuelle · {stageLabel(cv.currentStage)}
          </div>
          <StageStrip current={cv.currentStage} />
        </div>
      </div>

      {/* Three-column workspace */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Center — documents */}
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="serif text-[20px] font-semibold text-ink">Pièces justificatives</h2>
            <div className="text-[11.5px] uppercase tracking-[0.14em] text-ink-3">
              <strong className="text-ink">{accepted}</strong> / {REQUIRED_DOCS.length} acceptées
              {rejected > 0 && <span className="ml-3 text-cmred">· {rejected} rejetée{rejected > 1 ? 's' : ''}</span>}
            </div>
          </div>

          <ul className="mt-4 space-y-2">
            {tiles.map((t, i) =>
              t.tile ? (
                <DocumentTile key={t.slot.kind} index={i + 1} doc={t.tile} canEdit={canAct} />
              ) : (
                <li key={t.slot.kind} className="border border-dashed border-line-2 bg-white px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 flex-none items-center justify-center border border-dashed border-line-2 bg-bgsoft font-display text-[14px] font-bold italic text-ink-4">
                      {romanIndex(i + 1)}
                    </div>
                    <div className="flex-1">
                      <div className="text-[14px] font-semibold text-ink-3">{t.slot.title}</div>
                      <div className="text-[11.5px] italic text-cmred">Pièce manquante · à demander à l&apos;investisseur</div>
                    </div>
                    <span className="font-mono text-[10.5px] text-ink-3">{t.slot.article}</span>
                  </div>
                </li>
              ),
            )}
          </ul>

          {/* Recent activity (mini-timeline) */}
          <div className="mt-8 border border-line bg-white">
            <div className="border-b border-line bg-bgsoft px-5 py-2.5">
              <h3 className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-2">
                Derniers événements
              </h3>
            </div>
            <ul className="divide-y divide-line">
              {cv.workflowEvents.length === 0 && (
                <li className="px-5 py-4 text-[12.5px] italic text-ink-3">Aucun événement encore.</li>
              )}
              {cv.workflowEvents.map((ev) => (
                <li key={ev.id} className="grid grid-cols-[120px_1fr] gap-4 px-5 py-2.5">
                  <span className="font-mono text-[11.5px] text-ink-3">
                    {ev.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div className="text-[12.5px] text-ink-2">
                    <strong className="font-semibold text-ink">{actionFr(ev.action)}</strong>{' '}
                    · {stageLabel(ev.stage)}
                    {ev.actor && <span className="ml-1 italic text-ink-3">
                      par {ev.actor.name ?? '—'}{ev.actor.staffRole && ` (${roleLabel(ev.actor.staffRole, true)})`}
                    </span>}
                    {ev.comment && (
                      <blockquote className="mt-0.5 border-l-2 border-line-2 pl-2 italic text-ink-3">« {ev.comment} »</blockquote>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-5 py-2 text-right">
              <Link href={`/investor/conventions/${cv.id}`} className="text-[11px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink">
                Voir la chronologie complète →
              </Link>
            </div>
          </div>
        </div>

        {/* Right — action rail + Claude pane */}
        <aside className="space-y-4">
          <ActionRail ctx={actionCtx} />

          <AiPane
            conventionId={cv.id}
            claudeLive={isClaudeConfigured()}
            canAct={canAct}
            analyses={cv.aiAnalyses.map((a): AiAnalysisItem => {
              const docKind = a.documentId
                ? cv.documents.find((d) => d.id === a.documentId)?.kind ?? null
                : null;
              const slot = docKind ? REQUIRED_DOCS.find((s) => s.kind === docKind) : null;
              return {
                id: a.id,
                documentId: a.documentId,
                documentTitle: slot?.title ?? (docKind ? String(docKind) : null),
                generatedAt: a.generatedAt.toISOString(),
                summary: a.summary,
                contentJson: a.contentJson,
                modelName: a.modelName,
                tokensIn: a.tokensIn,
                tokensOut: a.tokensOut,
              };
            })}
          />
        </aside>
      </div>
    </section>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-3">{label}</dt>
      <dd className={'mt-0.5 text-[13px] font-semibold text-ink ' + (mono ? 'font-mono tabular' : '')}>{value}</dd>
    </div>
  );
}

function StageStrip({ current }: { current: string }) {
  const idx = STAGE_ORDER.indexOf(current as never);
  return (
    <div className="mt-2 flex items-center gap-1.5">
      {STAGE_ORDER.map((s, i) => {
        const here = i === idx;
        const done = i < idx;
        return (
          <div key={s} className="flex flex-1 items-center gap-2" title={STAGE_LABELS_FR[s]}>
            <span className={
              'flex h-6 w-6 items-center justify-center text-[10px] font-bold tabular ' +
              (here ? 'border border-cmgreen-800 bg-cmgreen-50 text-cmgreen-800' :
               done ? 'bg-cmgreen-800 text-white' :
               'border border-line-2 bg-white text-ink-4')
            }>
              {done ? '✓' : i + 1}
            </span>
            <span className={'text-[10.5px] uppercase tracking-[0.12em] truncate ' + (here ? 'font-bold text-ink' : done ? 'text-ink-3' : 'text-ink-4')}>
              {STAGE_LABELS_FR[s].replace('Dir. ', '').replace('Directeur Général', 'DG')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function romanIndex(n: number): string {
  return ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi'][n] ?? String(n);
}

function actionFr(action: WorkflowAction): string {
  switch (action) {
    case 'RECEIVED':       return 'Reçu';
    case 'RECEIPT_ISSUED': return 'Récépissé délivré';
    case 'SIGNED_OFF':     return 'Signature';
    case 'HANDED_OFF':     return 'Transmission';
    case 'RETURNED':       return 'Renvoi';
    case 'REJECTED':       return 'Rejet';
  }
}
