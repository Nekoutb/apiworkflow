import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getStaffScope, type StaffScope } from '@/lib/visibility';
import { roleLabel, roleMeta } from '@/lib/roles';
import type {
  StaffRole,
  DocumentStatus,
  HandoffType,
  ExternalRecipient,
} from '@prisma/client';
import { AppLogo } from '@/components/AppLogo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoutButton } from '@/components/LogoutButton';
import { NotificationBell } from '@/components/NotificationBell';
import { Icon } from '@/components/Icon';
import { ReminderButton } from './ReminderButton';

// =============================================================================
//  ÉTAT DES DOSSIERS — formerly /secretariat (B20 slice 2)
//
//  Same URL as before. The page is now available to every staff role with
//  two layouts:
//
//    A) FULL VISIBILITY (DG, DGA, SECRETARIAT_DG, CHEF_SERVICE_COURRIER,
//       ADMIN): keeps the original two-section view — "Chez le DG" +
//       "Dispatchés par le DG". Zero regression to the existing monitoring
//       workflow, just refreshed to V4 Civic Glass styling.
//
//    B) SCOPED (every other staff role): three sections that match the
//       three categories the operator described — "Reçus par moi (ou mes
//       subordonnés)" + "Envoyés à un autre service" + "Avis externe en
//       cours". Data filtered through the visibility module so each user
//       sees only their subtree + outbound traffic + their pending avis.
// =============================================================================

export const metadata = { title: 'État des dossiers · API Cameroun' };
export const dynamic = 'force-dynamic';

const SLA_TOTAL_MS = 72 * 3_600_000;
const SLA_AMBER_MS = 40 * 3_600_000;
const SLA_RED_MS = 60 * 3_600_000;

const OUTBOUND_TYPES: HandoffType[] = [
  'DG_DISPATCH',
  'VERTICAL_DOWN',
  'HORIZONTAL',
  'RETURN_UP',
  'RETURN_TO_DG',
  'EXTERNAL_OUT',
  'DG_TO_COURRIER',
];

const TERMINAL_STATUSES: DocumentStatus[] = ['CLOSED', 'RESPONSE_SENT'];

const STATUS_PILL: Partial<Record<DocumentStatus, { label: string; cls: string }>> = {
  AWAITING_DG_ANALYSIS: { label: 'Analyse DG', cls: 'dg' },
  AWAITING_DG_DECISION: { label: 'Décision DG', cls: 'dg' },
  ASSIGNED: { label: 'À traiter', cls: 'new' },
  IN_TREATMENT: { label: 'En traitement', cls: 'in-treatment' },
  AWAITING_EXTERNAL_AVIS: { label: 'Avis externe', cls: 'ext-avis' },
};

const EXTERNAL_LABEL: Record<ExternalRecipient, string> = {
  MINISTRE_FINANCES: 'Min. Finances',
  MINISTRE_INDUSTRIE: 'Min. Industrie',
  DGI: 'DGI',
  DGD: 'DGD',
  MINISTRE_AUTRE: 'Ministère (autre)',
  ADMINISTRATION_AUTRE: 'Administration (autre)',
};

// -----------------------------------------------------------------------------

export default async function EtatDesDossiersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect('/login');
  const scope = getStaffScope(session);
  if (!scope) redirect('/login');

  const roleFr = roleLabel(scope.selfRole);

  return (
    <main className="relative min-h-screen">
      <div className="relative z-10 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span> Portail interne · État des dossiers ·
        SLA 72 h <span className="text-gold-500">⚜</span>
      </div>

      <header className="v4-chrome glass glass-hi">
        <AppLogo asLink={false} />
        <div className="min-w-0 leading-tight">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-3">
            République du Cameroun
          </div>
          <div
            className="truncate text-[14.5px] font-bold text-navy"
            style={{ fontFamily: "var(--font-display), 'Lexend', sans-serif" }}
          >
            État des dossiers · {scope.hasFullVisibility ? 'Vue complète' : roleFr}
          </div>
        </div>
        <nav className="ml-6 hidden gap-1 md:flex">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy"
          >
            Tableau de bord
          </Link>
          <span className="rounded-lg bg-blue-600/12 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-navy">
            État des dossiers
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher variant="editorial" />
          <NotificationBell />
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-[13px] font-semibold text-navy">
              {session.user.name ?? session.user.email}
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleFr}</div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-6 sm:px-7 sm:py-10">
        {scope.hasFullVisibility ? (
          <PrivilegedView scope={scope} />
        ) : (
          <ScopedView scope={scope} roleFr={roleFr} />
        )}
      </section>
    </main>
  );
}

// =============================================================================
//  A) FULL-VISIBILITY VIEW — Chez le DG + Dispatchés par le DG
// =============================================================================

async function PrivilegedView({ scope }: { scope: StaffScope }) {
  const [withDg, dispatchedFromDg] = await Promise.all([
    db.document.findMany({
      where: { status: { in: ['AWAITING_DG_ANALYSIS', 'AWAITING_DG_DECISION'] } },
      orderBy: { updatedAt: 'asc' },
      take: 200,
      select: documentSelect,
    }),
    db.document.findMany({
      where: { status: { in: ['ASSIGNED', 'IN_TREATMENT', 'AWAITING_EXTERNAL_AVIS'] } },
      orderBy: { updatedAt: 'asc' },
      take: 200,
      select: documentSelect,
    }),
  ]);

  const withDgRows = withDg.map((d) => buildRow(d, 'with-dg'));
  const dispatchedRows = dispatchedFromDg.map((d) => buildRow(d, 'dispatched'));

  const overdue =
    withDgRows.filter((r) => r.sla.cls === 'red').length +
    dispatchedRows.filter((r) => r.sla.cls === 'red').length;
  const approaching =
    withDgRows.filter((r) => r.sla.cls === 'amber').length +
    dispatchedRows.filter((r) => r.sla.cls === 'amber').length;

  return (
    <>
      <PageHead
        kicker="Vue complète · Secrétariat DG"
        title="État des dossiers"
        intro="Politique gouvernementale : tout document doit être traité dans les 72 h. Cliquez sur 🔔 Rappeler pour notifier le détenteur."
      />

      <Kpis
        items={[
          { label: 'Chez le DG', num: withDg.length, hint: 'à analyser & décider' },
          { label: 'Dispatchés par DG', num: dispatchedFromDg.length, hint: 'en cours dans les unités' },
          {
            label: 'SLA dépassé',
            num: overdue,
            alert: overdue > 0,
            hint: overdue > 0 ? 'à rappeler en priorité' : 'aucun dépassement',
          },
          {
            label: 'Approchent 72 h',
            num: approaching,
            warn: approaching > 0,
            hint: approaching > 0 ? '< 32 h restant' : 'pas d\'alerte amber',
          },
        ]}
      />

      <Section
        title={`Dossiers chez le DG (${withDgRows.length})`}
        intro="En attente d'analyse (nouvelle arrivée) ou de décision finale (retour d'un département après traitement)."
        rows={withDgRows}
        emptyHint="Aucun dossier chez le DG actuellement."
      />

      <Section
        title={`Dossiers dispatchés par le DG (${dispatchedRows.length})`}
        intro="Sortis du DG vers les unités. La durée est calculée depuis que le détenteur courant l'a reçu (la délégation interne réinitialise le compteur)."
        rows={dispatchedRows}
        emptyHint="Aucun dossier en cours dans les unités."
      />
    </>
  );
}

// =============================================================================
//  B) SCOPED VIEW — Reçus + Envoyés + Avis externe (per the visibility rule)
// =============================================================================

async function ScopedView({ scope, roleFr }: { scope: StaffScope; roleFr: string }) {
  const roles = scope.roleScope;

  // 1. Reçus by me or my subordinates (active assignments to my subtree)
  // 2. Envoyés à un autre service (docs we sent out, currently held elsewhere)
  // 3. Avis externe en cours (pending external transmissions our subtree sent)
  const [received, sentDocs, externalTx] = await Promise.all([
    db.assignment.findMany({
      where: {
        status: 'ACTIVE',
        assignedToRole: { in: roles },
        document: { status: { notIn: TERMINAL_STATUSES } },
      },
      orderBy: { assignedAt: 'asc' },
      take: 200,
      select: {
        id: true,
        assignedAt: true,
        assignedToRole: true,
        document: { select: documentSelect },
      },
    }),
    db.document.findMany({
      where: {
        status: { notIn: TERMINAL_STATUSES },
        currentHolderRole: { notIn: roles }, // handed away, currently elsewhere
        handoffs: {
          some: {
            fromRole: { in: roles },
            type: { in: OUTBOUND_TYPES },
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
      take: 200,
      select: {
        ...documentSelect,
        handoffs: {
          where: { fromRole: { in: roles }, type: { in: OUTBOUND_TYPES } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { type: true, fromRole: true, toRole: true, createdAt: true },
        },
      },
    }),
    db.externalTransmission.findMany({
      where: { status: 'PENDING', sentBy: { staffRole: { in: roles } } },
      orderBy: { sentAt: 'asc' },
      take: 100,
      select: {
        id: true,
        recipient: true,
        recipientName: true,
        sentAt: true,
        expectedReturnAt: true,
        document: { select: documentSelect },
        sentBy: { select: { name: true, email: true, staffRole: true } },
      },
    }),
  ]);

  // ---- Build rows for each section ------------------------------------------

  const receivedRows = received.map((a) =>
    buildRow(
      // For received: SLA from when assigned to the role
      { ...a.document, _refTime: a.assignedAt, _holderRoleOverride: a.assignedToRole },
      'received',
    ),
  );

  const sentRows = sentDocs.map((d) => {
    const sentAt = d.handoffs[0]?.createdAt ?? d.updatedAt;
    const toRole = d.handoffs[0]?.toRole ?? d.currentHolderRole ?? null;
    return buildRow(
      { ...d, _refTime: sentAt, _sentToRoleOverride: toRole },
      'sent',
    );
  });

  const externalRows = externalTx.map((t) => {
    const sla = slaState(t.sentAt, t.expectedReturnAt ?? undefined);
    return {
      id: t.id,
      reference: t.document.reference,
      documentId: t.document.id,
      subject: t.document.subject,
      sender: t.document.submission?.senderName ?? '—',
      senderOrg: t.document.submission?.senderOrganization ?? null,
      counterparty: {
        label: EXTERNAL_LABEL[t.recipient] + (t.recipientName ? ` · ${t.recipientName}` : ''),
        role: null as StaffRole | null,
      },
      refTime: t.sentAt,
      pill: { label: 'En attente', cls: 'ext-avis' },
      sla,
      status: 'AWAITING_EXTERNAL_AVIS' as DocumentStatus,
      kind: 'external' as const,
      sentByName: t.sentBy?.name ?? null,
      sentByRole: t.sentBy?.staffRole ?? null,
    };
  });

  const overdue =
    receivedRows.filter((r) => r.sla.cls === 'red').length +
    sentRows.filter((r) => r.sla.cls === 'red').length;
  const approaching =
    receivedRows.filter((r) => r.sla.cls === 'amber').length +
    sentRows.filter((r) => r.sla.cls === 'amber').length;

  const subtreeBreadth = roles.length;

  return (
    <>
      <PageHead
        kicker={`Mon périmètre · ${roleFr}`}
        title="État des dossiers"
        intro={`Vue scopée sur votre périmètre organigramme (${subtreeBreadth} rôle${subtreeBreadth > 1 ? 's' : ''} dans votre arborescence). Politique gouvernementale : tout document doit être traité dans les 72 h.`}
      />

      <Kpis
        items={[
          {
            label: 'Reçus',
            num: receivedRows.length,
            hint: 'à traiter dans votre arborescence',
          },
          {
            label: 'Envoyés à un service',
            num: sentRows.length,
            hint: 'en attente chez un autre service',
          },
          {
            label: 'Avis externe en cours',
            num: externalRows.length,
            hint: 'Min. Finances · DGI · DGD · etc.',
          },
          {
            label: 'SLA dépassé',
            num: overdue,
            alert: overdue > 0,
            warn: overdue === 0 && approaching > 0,
            hint:
              overdue > 0
                ? 'à rappeler en priorité'
                : approaching > 0
                  ? `${approaching} approchent 72 h`
                  : 'aucune alerte',
          },
        ]}
      />

      <Section
        title={`Reçus par moi (ou mes subordonnés) — ${receivedRows.length}`}
        intro="Dossiers actuellement affectés à votre rôle ou à un rôle sous votre responsabilité. Le compteur SLA part du moment de l'affectation."
        rows={receivedRows}
        emptyHint="Aucune affectation active dans votre arborescence."
      />

      <Section
        title={`Envoyés à un autre service — ${sentRows.length}`}
        intro="Dossiers que vous (ou un subordonné) avez transmis et qui se trouvent actuellement chez un autre service. Le compteur SLA part de l'envoi."
        rows={sentRows}
        emptyHint="Aucun dossier envoyé en attente d'action ailleurs."
      />

      <Section
        title={`Avis externe en cours — ${externalRows.length}`}
        intro="Transmissions envoyées à des destinataires externes (Min. Finances, DGI, DGD, etc.) et toujours en attente de retour. Le SLA est calculé depuis l'envoi (ou la date de retour attendue si renseignée)."
        rows={externalRows}
        emptyHint="Aucune transmission externe en attente."
      />
    </>
  );
}

// =============================================================================
//  REUSABLE V4 COMPONENTS
// =============================================================================

function PageHead({
  kicker,
  title,
  intro,
}: {
  kicker: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="v4-page-head">
      <div className="kicker">
        <span className="dot" />
        {kicker}
      </div>
      <h1>{title}</h1>
      <p>{intro}</p>
    </div>
  );
}

type KpiItem = {
  label: string;
  num: number;
  hint?: string;
  alert?: boolean;
  warn?: boolean;
};

function Kpis({ items }: { items: KpiItem[] }) {
  return (
    <div className="v4-kpis">
      {items.map((it) => (
        <div key={it.label} className="v4-kpi glass">
          <div className="label">{it.label}</div>
          <div
            className="num"
            style={it.alert ? { color: '#c8102e' } : it.warn ? { color: '#d97706' } : undefined}
          >
            {it.num}
          </div>
          <div className={`delta ${it.alert ? 'alert' : it.warn ? '' : ''}`}>
            {it.alert && <Icon name="warn" className="icon-sm" />}
            {it.hint}
          </div>
        </div>
      ))}
    </div>
  );
}

type Row = {
  id: string;
  reference: string;
  documentId: string;
  subject: string;
  sender: string;
  senderOrg: string | null;
  counterparty: { label: string; role: StaffRole | null } | null;
  refTime: Date;
  pill: { label: string; cls: string };
  sla: { pct: number; cls: string; label: string };
  status: DocumentStatus;
  kind: 'with-dg' | 'dispatched' | 'received' | 'sent' | 'external';
  sentByName?: string | null;
  sentByRole?: StaffRole | null;
};

function Section({
  title,
  intro,
  rows,
  emptyHint,
}: {
  title: string;
  intro: string;
  rows: Row[];
  emptyHint: string;
}) {
  return (
    <div className="mt-12">
      <h2
        className="text-[18px] font-bold text-navy"
        style={{ fontFamily: "var(--font-display), 'Lexend', sans-serif" }}
      >
        {title}
      </h2>
      <p className="mt-1 mb-4 text-[12.5px] italic text-ink-3">{intro}</p>

      <div className="v4-table glass">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[13px] italic text-ink-3">{emptyHint}</p>
          </div>
        ) : (
          <>
            <div className="v4-thead">
              <div>Référence · Objet</div>
              <div>Émetteur</div>
              <div>{counterpartyHeader(rows[0]?.kind)}</div>
              <div>Statut</div>
              <div>SLA 72 h</div>
              <div>Rappel</div>
            </div>
            {rows.map((r) => (
              <RowItem key={r.id} row={r} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function counterpartyHeader(kind?: Row['kind']): string {
  switch (kind) {
    case 'with-dg':
      return 'Reçu le';
    case 'dispatched':
    case 'received':
      return 'Détenteur';
    case 'sent':
      return 'Envoyé vers';
    case 'external':
      return 'Destinataire externe';
    default:
      return '';
  }
}

function RowItem({ row }: { row: Row }) {
  const counter = row.counterparty;
  return (
    <div className="v4-row" role="row">
      <div className="obj">
        <div className="ref">
          <Link
            href={`/unit/parapheur/${row.documentId}`}
            className="hover:underline focus-visible:underline"
          >
            {row.reference}
          </Link>
        </div>
        <div className="subj">{row.subject}</div>
      </div>
      <div className="sender">
        {row.sender}
        {row.senderOrg && <span className="ent">{row.senderOrg}</span>}
      </div>
      <div className="sender">
        {counter ? (
          <>
            {counter.label}
            {counter.role && (
              <span className="ent">{roleMeta(counter.role)?.shortFr ?? counter.role}</span>
            )}
          </>
        ) : (
          <span className="text-ink-4">—</span>
        )}
      </div>
      <div className="status">
        <span className={`status-pill ${row.pill.cls}`}>{row.pill.label}</span>
      </div>
      <div className={`v4-sla ${row.sla.cls}`}>
        <div className="bar">
          <div className="fill" style={{ width: `${row.sla.pct}%` }} />
        </div>
        <div className="label">{row.sla.label}</div>
      </div>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        <ReminderButton documentId={row.documentId} />
      </div>
    </div>
  );
}

// =============================================================================
//  Data plumbing
// =============================================================================

const documentSelect = {
  id: true,
  reference: true,
  subject: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  currentHolderRole: true,
  currentHolderUserId: true,
  submission: {
    select: { senderName: true, senderEmail: true, senderOrganization: true },
  },
} as const;

type RawDoc = {
  id: string;
  reference: string;
  subject: string;
  status: DocumentStatus;
  submittedAt: Date;
  updatedAt: Date;
  currentHolderRole: StaffRole | null;
  currentHolderUserId: string | null;
  submission: {
    senderName: string | null;
    senderEmail: string | null;
    senderOrganization: string | null;
  } | null;
  _refTime?: Date;
  _holderRoleOverride?: StaffRole | null;
  _sentToRoleOverride?: StaffRole | null;
};

function buildRow(d: RawDoc, kind: Row['kind']): Row {
  const refTime = d._refTime ?? d.updatedAt ?? d.submittedAt;
  const paused = d.status === 'AWAITING_EXTERNAL_AVIS';
  const sla = slaState(refTime, paused);
  const pill = STATUS_PILL[d.status] ?? { label: d.status, cls: '' };

  let counterpartyRole: StaffRole | null = null;
  let counterpartyLabel = '';
  switch (kind) {
    case 'with-dg':
      counterpartyLabel = refTime.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
        + ' · ' + refTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      break;
    case 'dispatched':
    case 'received': {
      const role = d._holderRoleOverride ?? d.currentHolderRole;
      counterpartyRole = role ?? null;
      counterpartyLabel = role ? roleLabel(role) : '—';
      break;
    }
    case 'sent': {
      const role = d._sentToRoleOverride ?? d.currentHolderRole;
      counterpartyRole = role ?? null;
      counterpartyLabel = role ? roleLabel(role) : '—';
      break;
    }
    case 'external':
      // handled inline by caller
      counterpartyLabel = '';
      break;
  }

  return {
    id: d.id,
    reference: d.reference,
    documentId: d.id,
    subject: d.subject,
    sender: d.submission?.senderName ?? '—',
    senderOrg: d.submission?.senderOrganization ?? null,
    counterparty: kind === 'with-dg' ? null : { label: counterpartyLabel, role: counterpartyRole },
    refTime,
    pill,
    sla,
    status: d.status,
    kind,
  };
}

function slaState(referenceTime: Date, paused?: boolean | Date) {
  if (paused === true) return { pct: 100, cls: 'paused', label: 'SLA suspendu' };
  const elapsed = Date.now() - referenceTime.getTime();
  const pct = Math.min(100, Math.max(2, Math.round((elapsed / SLA_TOTAL_MS) * 100)));
  const remaining = SLA_TOTAL_MS - elapsed;
  if (remaining < 0) return { pct, cls: 'red', label: `+${humanDuration(-remaining)} dépassé` };
  if (elapsed > SLA_RED_MS) return { pct, cls: 'red', label: `${humanDuration(remaining)} restant` };
  if (elapsed > SLA_AMBER_MS) return { pct, cls: 'amber', label: `${humanDuration(remaining)} restant` };
  return { pct, cls: '', label: `${humanDuration(remaining)} restant` };
}

function humanDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  if (h < 1) return `${totalMin} min`;
  if (h < 24) {
    const min = totalMin % 60;
    return min === 0 ? `${h} h` : `${h} h ${String(min).padStart(2, '0')}`;
  }
  const d = Math.floor(h / 24);
  return `${d} j`;
}
