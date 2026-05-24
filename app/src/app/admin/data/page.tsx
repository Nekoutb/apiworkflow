import Link from 'next/link';
import { db } from '@/lib/db';
import { formatFcfaCompact } from '@/lib/fcfa';
import {
  STAGE_LABELS_FR,
  STAGE_ORDER,
  sectorLabel,
  stageIndex,
  stageLabel,
  statusLabel,
  statusPillClass,
} from '@/lib/stages';

export const metadata = { title: 'Aperçu base de données · Administration' };
export const dynamic = 'force-dynamic';

export default async function AdminDataPage() {
  // Run everything in parallel.
  const [
    userCount,
    investorCount,
    conventionCount,
    documentCount,
    eventCount,
    notificationCount,
    aiAnalysisCount,
    financialSummaryCount,
    auditCount,
    conventions,
  ] = await Promise.all([
    db.user.count(),
    db.investor.count(),
    db.convention.count(),
    db.document.count(),
    db.workflowEvent.count(),
    db.notification.count(),
    db.aiAnalysis.count(),
    db.financialSummary.count(),
    db.auditTrailEntry.count(),
    db.convention.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        investor: { select: { raisonSociale: true } },
        _count: { select: { documents: true, workflowEvents: true } },
      },
    }),
  ]);

  const counts: { label: string; value: number; helper?: string }[] = [
    { label: 'Comptes utilisateurs',      value: userCount,            helper: '6 personnel + 3 investisseurs' },
    { label: 'Investisseurs',             value: investorCount,        helper: '1 existant · 2 nouveaux' },
    { label: 'Conventions',               value: conventionCount,      helper: '3 états distincts' },
    { label: 'Documents',                 value: documentCount },
    { label: "Événements d'instruction",  value: eventCount },
    { label: 'Notifications',             value: notificationCount },
    { label: 'Analyses IA (Claude)',      value: aiAnalysisCount,      helper: 'Activé en A14' },
    { label: 'Résumés financiers',        value: financialSummaryCount },
    { label: 'Audit trail (sécurité)',    value: auditCount,           helper: 'Activé en A21' },
  ];

  return (
    <section className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        Administration
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">Aperçu base de données</h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        Toutes les entités du modèle de données A3 sont en ligne sur Neon (Frankfurt). 3 conventions d'exemple
        couvrent les trois grandes situations du workflow.
      </p>

      {/* Counts grid */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map((c) => (
          <div key={c.label} className="border border-line bg-white p-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              {c.label}
            </div>
            <div className="serif mt-1 text-[34px] font-bold leading-none tracking-[-0.5px] text-ink">
              {c.value}
            </div>
            {c.helper && <div className="mt-2 text-[11.5px] italic text-ink-4">{c.helper}</div>}
          </div>
        ))}
      </div>

      {/* Conventions table */}
      <div className="mt-12">
        <h2 className="serif text-[22px] font-semibold text-ink">Conventions enregistrées</h2>
        <p className="serif mt-1 text-[13px] italic text-ink-3">
          Données factices pour tester l'affichage du workflow. Seront remplacées par les vraies soumissions en A4 / A5.
        </p>

        <div className="mt-5 border border-line bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-bgsoft text-left">
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Référence</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Investisseur</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Secteur</th>
                <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Investissement</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Étape</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {conventions.map((c) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3.5 font-mono text-[12.5px] text-ink">
                    {c.reference}
                    <div className="text-[11px] font-sans italic text-ink-3">{c.projectName}</div>
                  </td>
                  <td className="px-4 py-3.5 text-[13px] text-ink-2">{c.investor.raisonSociale}</td>
                  <td className="px-4 py-3.5 text-[13px] text-ink-2">{sectorLabel(c.sector)}</td>
                  <td className="px-4 py-3.5 text-right font-mono text-[12.5px] text-ink-2 tabular">
                    {formatFcfaCompact(c.investmentFcfa)}
                    <div className="text-[10.5px] uppercase tracking-[0.12em] text-ink-4">Catégorie {c.category}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <StageStepper current={c.currentStage} status={c.status} />
                    <div className="mt-1 text-[11px] italic text-ink-3">
                      {c._count.documents} doc · {c._count.workflowEvents} événement{c._count.workflowEvents > 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`pill ${statusPillClass(c.status)}`}>{statusLabel(c.status)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10 flex gap-3">
        <Link
          href="/admin/users"
          className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink"
        >
          ← Gestion du personnel
        </Link>
        <Link
          href="/dashboard"
          className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink"
        >
          Tableau de bord
        </Link>
      </div>
    </section>
  );
}

function StageStepper({ current, status }: { current: string; status: string }) {
  const idx = stageIndex(current as never);
  const isSigned = status === 'SIGNED' || status === 'CLOSED';
  return (
    <div className="flex items-center gap-1.5">
      {STAGE_ORDER.map((s, i) => {
        const reached = isSigned ? true : i < idx;
        const here = i === idx && !isSigned;
        return (
          <div
            key={s}
            title={STAGE_LABELS_FR[s]}
            className={
              'flex h-5 w-5 items-center justify-center text-[10px] font-bold tabular ' +
              (here
                ? 'border border-cmgreen-800 bg-cmgreen-50 text-cmgreen-800'
                : reached
                  ? 'bg-cmgreen-800 text-white'
                  : 'border border-line-2 bg-white text-ink-4')
            }
          >
            {i + 1}
          </div>
        );
      })}
      <span className="ml-2 text-[12px] font-semibold text-ink">
        {isSigned ? '✓ Signée' : stageLabel(current as never)}
      </span>
    </div>
  );
}
