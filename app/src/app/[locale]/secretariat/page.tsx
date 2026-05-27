import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel, roleMeta } from '@/lib/roles';
import type { StaffRole, DocumentStatus, HandoffType } from '@prisma/client';
import { ReminderButton } from './ReminderButton';
import { NotificationBell } from '@/components/NotificationBell';

export const metadata = { title: 'Secrétariat DG · Monitoring · API Cameroun' };
export const dynamic = 'force-dynamic';

// SECRETARIAT_DG monitors flows in/out of the DG.
// CHEF_SERVICE_COURRIER + ADMIN get the same view (per spec).
const ALLOWED: StaffRole[] = ['SECRETARIAT_DG', 'CHEF_SERVICE_COURRIER', 'ADMIN'];

const NATURE_SHORT: Record<string, string> = {
  AGREMENT_REQUEST: "Demande d'agrément",
  GENERAL_CORRESPONDENCE: 'Correspondance',
  OFFICIAL_NOTIFICATION: 'Notification',
  PARTNERSHIP_PROPOSAL: 'Partenariat',
  COMPLAINT: 'Réclamation',
  REPORT: 'Rapport',
  OTHER: 'Autre',
};

const STATUS_SHORT: Partial<Record<DocumentStatus, string>> = {
  AWAITING_DG_ANALYSIS:   'Analyse DG',
  AWAITING_DG_DECISION:   'Décision DG',
  ASSIGNED:               'À prendre en charge',
  IN_TREATMENT:           'En traitement',
  AWAITING_EXTERNAL_AVIS: 'Avis externe',
};

// Government policy: documents should be treated within 72h.
const SLA_HOURS = 72;

export default async function SecretariatDashboardPage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || !ALLOWED.includes(role)) redirect('/dashboard');

  // -------------------------------------------------------------------------
  //  Section 1 — Documents currently with the DG (analysis or decision)
  //  Section 2 — Documents dispatched by DG (sitting in units)
  // -------------------------------------------------------------------------

  const [withDg, dispatchedFromDg] = await Promise.all([
    db.document.findMany({
      where: { status: { in: ['AWAITING_DG_ANALYSIS', 'AWAITING_DG_DECISION'] } },
      orderBy: { updatedAt: 'asc' },
      take: 200,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        status: true,
        submittedAt: true,
        updatedAt: true,
        currentHolderRole: true,
        submission: {
          select: { senderName: true, senderEmail: true, senderOrganization: true },
        },
        handoffs: {
          where: { type: { in: ['COURRIER_TO_DG', 'RETURN_TO_DG'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { type: true, createdAt: true, fromRole: true },
        },
      },
    }),
    db.document.findMany({
      where: {
        status: { in: ['ASSIGNED', 'IN_TREATMENT', 'AWAITING_EXTERNAL_AVIS'] },
      },
      orderBy: { updatedAt: 'asc' },
      take: 200,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        status: true,
        currentHolderRole: true,
        currentHolderUserId: true,
        submission: {
          select: { senderName: true, senderEmail: true, senderOrganization: true },
        },
        // Most recent handoff to find when the current holder received it
        handoffs: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { type: true, toRole: true, fromRole: true, createdAt: true },
        },
      },
    }),
  ]);

  // Total stats: count by SLA bucket
  const withDgRows = withDg.map((d) => {
    const arrival = d.handoffs[0]?.createdAt ?? d.submittedAt;
    return { ...d, arrivedAt: arrival, hoursWithHolder: hoursSince(arrival) };
  });
  const dispatchedRows = dispatchedFromDg.map((d) => {
    // Find the most recent handoff that landed the doc with currentHolderRole
    const landed = d.handoffs.find((h) => h.toRole === d.currentHolderRole) ?? d.handoffs[0];
    const arrival = landed?.createdAt ?? d.handoffs[0]?.createdAt ?? new Date();
    return { ...d, arrivedAt: arrival, hoursWithHolder: hoursSince(arrival) };
  });

  const overdueWithDg = withDgRows.filter((r) => r.hoursWithHolder > SLA_HOURS).length;
  const overdueDispatched = dispatchedRows.filter((r) => r.hoursWithHolder > SLA_HOURS).length;
  const totalOverdue = overdueWithDg + overdueDispatched;
  const approachingSla =
    withDgRows.filter((r) => r.hoursWithHolder > SLA_HOURS - 24 && r.hoursWithHolder <= SLA_HOURS).length +
    dispatchedRows.filter((r) => r.hoursWithHolder > SLA_HOURS - 24 && r.hoursWithHolder <= SLA_HOURS).length;

  const headerLabel =
    role === 'SECRETARIAT_DG' ? 'Secrétariat DG — Monitoring 72h' :
    role === 'CHEF_SERVICE_COURRIER' ? 'Service du Courrier — Monitoring 72h' :
    'Monitoring 72h (vue admin)';

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span>
        Monitoring <span className="mx-3 text-gold-500">⚜</span>
        SLA 72h
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <Link
            href="/dashboard"
            className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500"
            aria-label="Tableau de bord"
          >
            A
            <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
          </Link>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Portail interne · Monitoring DG
            </div>
            <div className="serif text-[17px] font-bold text-ink">{headerLabel}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">
                {session.user.name ?? session.user.email}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
                {roleLabel(role)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-10">
        {/* Stats — SLA snapshot */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Chez le DG" value={withDg.length} accent />
          <Stat label="Dispatchés par DG" value={dispatchedFromDg.length} accent />
          <Stat
            label="⚠ SLA 72h dépassé"
            value={totalOverdue}
            urgent={totalOverdue > 0}
          />
          <Stat
            label="Approchent 72h (48-72h)"
            value={approachingSla}
            warn={approachingSla > 0}
          />
        </div>

        <p className="serif mt-4 text-[12.5px] italic text-ink-3">
          Politique gouvernementale : tout document doit être traité dans les{' '}
          <strong className="not-italic">72 heures</strong>. Les indicateurs rouges signalent un
          dépassement ; cliquez sur <strong className="not-italic">🔔 Rappeler</strong> pour
          notifier le détenteur.
        </p>

        {/* Section 1 — With DG */}
        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Dossiers chez le DG ({withDg.length})
        </h2>
        <p className="serif mb-4 text-[12.5px] italic text-ink-3">
          Documents actuellement entre les mains du DG, en attente d&apos;analyse (nouvelle
          arrivée) ou de décision finale (retour d&apos;un département après traitement).
        </p>

        {withDgRows.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            Aucun dossier chez le DG actuellement.
          </div>
        ) : (
          <DocsTable rows={withDgRows} kind="with-dg" />
        )}

        {/* Section 2 — Dispatched by DG */}
        <h2 className="serif mb-3 mt-16 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Dossiers dispatchés par le DG ({dispatchedFromDg.length})
        </h2>
        <p className="serif mb-4 text-[12.5px] italic text-ink-3">
          Documents sortis du DG vers les unités. La durée affichée est le temps écoulé depuis
          que le dossier est entre les mains du détenteur courant (pas depuis le dispatch
          initial — la délégation interne réinitialise le compteur).
        </p>

        {dispatchedRows.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            Aucun dossier dispatché actuellement en cours dans les unités.
          </div>
        ) : (
          <DocsTable rows={dispatchedRows} kind="dispatched" />
        )}

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            ← Tableau de bord
          </Link>
        </div>
      </section>
    </main>
  );
}

// ============================================================================
//  Reusable docs table
// ============================================================================

type Row = {
  id: string;
  reference: string;
  subject: string;
  nature: string;
  status: DocumentStatus;
  arrivedAt: Date;
  hoursWithHolder: number;
  currentHolderRole?: StaffRole | null;
  submission: { senderName: string | null; senderEmail: string | null; senderOrganization: string | null } | null;
  handoffs: Array<{ type: HandoffType; fromRole?: StaffRole | null; toRole?: StaffRole | null; createdAt: Date }>;
};

function DocsTable({ rows, kind }: { rows: Row[]; kind: 'with-dg' | 'dispatched' }) {
  return (
    <div className="overflow-x-auto border border-line bg-white">
      <table className="w-full">
        <thead className="bg-bgsoft">
          <tr className="text-left">
            <Th>Référence</Th>
            <Th>Émetteur</Th>
            <Th>Objet</Th>
            <Th>Nature</Th>
            <Th>Statut</Th>
            {kind === 'dispatched' && <Th>Détenteur actuel</Th>}
            <Th>Reçu le</Th>
            <Th>Attente</Th>
            <Th>SLA 72h</Th>
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const remaining = SLA_HOURS - r.hoursWithHolder;
            const slaState =
              r.hoursWithHolder > SLA_HOURS ? 'overdue' :
              r.hoursWithHolder > SLA_HOURS - 24 ? 'critical' :
              r.hoursWithHolder > SLA_HOURS - 48 ? 'warn' :
              'ok';
            return (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-3 py-3 font-mono text-[11px] font-semibold text-cmgreen-900">
                  {r.reference}
                </td>
                <td className="px-3 py-3 text-[12px]">
                  <div className="font-semibold text-ink">{r.submission?.senderName ?? '—'}</div>
                  <div className="text-[10.5px] text-ink-3">{r.submission?.senderEmail}</div>
                  {r.submission?.senderOrganization && (
                    <div className="text-[10px] italic text-ink-4">{r.submission.senderOrganization}</div>
                  )}
                </td>
                <td className="px-3 py-3 text-[12px] text-ink-2">
                  <div className="max-w-[260px] truncate" title={r.subject}>{r.subject}</div>
                </td>
                <td className="px-3 py-3 text-[10.5px] text-ink-3">
                  {NATURE_SHORT[r.nature] ?? r.nature}
                </td>
                <td className="px-3 py-3 text-[10.5px]">
                  <span className="inline-block bg-bgsoft px-1.5 py-0.5 font-semibold text-ink-2">
                    {STATUS_SHORT[r.status] ?? r.status}
                  </span>
                </td>
                {kind === 'dispatched' && (
                  <td className="px-3 py-3 text-[11px]">
                    <div className="font-semibold text-ink-2">
                      {r.currentHolderRole ? roleMeta(r.currentHolderRole)?.shortFr ?? r.currentHolderRole : '—'}
                    </div>
                    {r.currentHolderRole && (
                      <div className="font-mono text-[9.5px] text-ink-4">{r.currentHolderRole}</div>
                    )}
                  </td>
                )}
                <td className="px-3 py-3 text-[10.5px] text-ink-3">
                  <div>{r.arrivedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</div>
                  <div className="font-mono text-[9.5px] text-ink-4">
                    {r.arrivedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </td>
                <td className={'px-3 py-3 font-mono text-[11px] font-semibold ' + slaTextClass(slaState)}>
                  {fmtHours(r.hoursWithHolder)}
                </td>
                <td className="px-3 py-3 min-w-[110px]">
                  <SlaBar hours={r.hoursWithHolder} remaining={remaining} state={slaState} />
                </td>
                <td className="px-3 py-3">
                  <ReminderButton documentId={r.id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
//  Helpers
// ============================================================================

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

function fmtHours(h: number): string {
  if (h < 1)   return `${Math.round(h * 60)} min`;
  if (h < 24)  return `${h.toFixed(1)} h`;
  const days = Math.floor(h / 24);
  const rem  = Math.floor(h - days * 24);
  return `${days}j ${rem}h`;
}

function slaTextClass(state: 'ok' | 'warn' | 'critical' | 'overdue'): string {
  return state === 'overdue'  ? 'text-cmred font-bold' :
         state === 'critical' ? 'text-gold-700 font-bold' :
         state === 'warn'     ? 'text-gold-600' :
                                'text-cmgreen-700';
}

function SlaBar({
  hours, remaining, state,
}: { hours: number; remaining: number; state: 'ok' | 'warn' | 'critical' | 'overdue' }) {
  // Width as % of SLA window (capped at 100%+ overflow indicator)
  const pct = Math.min(Math.round((hours / SLA_HOURS) * 100), 100);
  const barColor =
    state === 'overdue'  ? 'bg-cmred' :
    state === 'critical' ? 'bg-gold-700' :
    state === 'warn'     ? 'bg-gold-500' :
                           'bg-cmgreen-700';
  return (
    <div className="space-y-1">
      <div className="relative h-1.5 w-full overflow-hidden rounded-sm bg-line">
        <div
          className={'absolute inset-y-0 left-0 ' + barColor}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className={'text-[9.5px] font-bold uppercase tracking-[0.06em] ' + slaTextClass(state)}>
        {state === 'overdue'
          ? `+${fmtHours(-remaining)} dépassé`
          : remaining < 24
            ? `${fmtHours(remaining)} restantes`
            : `${fmtHours(remaining)} restantes`}
      </div>
    </div>
  );
}

function Stat({
  label, value, accent, urgent, warn,
}: {
  label: string; value: number | string; accent?: boolean; urgent?: boolean; warn?: boolean;
}) {
  return (
    <div
      className={
        'border bg-white px-4 py-3.5 ' +
        (urgent ? 'border-cmred' : warn ? 'border-gold-700' : accent ? 'border-cmgreen-700' : 'border-line')
      }
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div
        className={
          'mt-1 text-[24px] font-semibold ' +
          (urgent ? 'text-cmred' : warn ? 'text-gold-700' : accent ? 'text-cmgreen-900' : 'text-ink')
        }
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
      {children}
    </th>
  );
}
