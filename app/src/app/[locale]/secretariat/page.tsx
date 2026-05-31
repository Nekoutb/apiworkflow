import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
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

type TSecretariat = Awaited<ReturnType<typeof getTranslations<'Secretariat'>>>;
type TSla = Awaited<ReturnType<typeof getTranslations<'Sla'>>>;
type TTime = Awaited<ReturnType<typeof getTranslations<'Time'>>>;
type TExtRecipient = Awaited<ReturnType<typeof getTranslations<'ExternalRecipient'>>>;
type TCommon = Awaited<ReturnType<typeof getTranslations<'Common'>>>;
type TDocStatus = Awaited<ReturnType<typeof getTranslations<'DocStatus'>>>;

type LocaleShort = 'fr' | 'en';

// -----------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const tMeta = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: tMeta('secretariatTitle') };
}

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

  const t = await getTranslations('Secretariat');
  const tCommon = await getTranslations('Common');
  const tDashboard = await getTranslations('Dashboard');
  const tSla = await getTranslations('Sla');
  const tTime = await getTranslations('Time');
  const tExt = await getTranslations('ExternalRecipient');
  const tStatus = await getTranslations('DocStatus');
  const localeShort: LocaleShort = locale === 'en' ? 'en' : 'fr';

  const localizedRole = roleLabel(scope.selfRole, localeShort);

  return (
    <main className="relative min-h-screen">
      <div className="relative z-10 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span> {tCommon('internalPortal')} · {t('title')} ·
        SLA 72 h <span className="text-gold-500">⚜</span>
      </div>

      <header className="v4-chrome glass glass-hi">
        <AppLogo asLink={false} />
        <div className="min-w-0 leading-tight">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.22em] text-ink-3">
            {tCommon('republic')}
          </div>
          <div
            className="truncate text-[14.5px] font-bold text-navy"
            style={{ fontFamily: "var(--font-display), 'Lexend', sans-serif" }}
          >
            {t('title')} · {scope.hasFullVisibility ? t('fullView') : localizedRole}
          </div>
        </div>
        <nav className="ml-6 hidden gap-1 md:flex">
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-3 transition hover:bg-blue-600/8 hover:text-navy"
          >
            {tDashboard('panelHeading')}
          </Link>
          <span className="rounded-lg bg-blue-600/12 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-navy">
            {t('title')}
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <LanguageSwitcher variant="editorial" />
          <NotificationBell />
          <div className="hidden text-right leading-tight sm:block">
            <div className="text-[13px] font-semibold text-navy">
              {session.user.name ?? session.user.email}
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{localizedRole}</div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-6 sm:px-7 sm:py-10">
        {scope.hasFullVisibility ? (
          <PrivilegedView
            scope={scope}
            t={t}
            tCommon={tCommon}
            tSla={tSla}
            tTime={tTime}
            tExt={tExt}
            tStatus={tStatus}
            locale={localeShort}
          />
        ) : (
          <ScopedView
            scope={scope}
            roleLabel={localizedRole}
            t={t}
            tCommon={tCommon}
            tSla={tSla}
            tTime={tTime}
            tExt={tExt}
            tStatus={tStatus}
            locale={localeShort}
          />
        )}
      </section>
    </main>
  );
}

// =============================================================================
//  A) FULL-VISIBILITY VIEW
// =============================================================================

async function PrivilegedView({
  scope: _scope,
  t,
  tCommon: _tCommon,
  tSla,
  tTime,
  tExt: _tExt,
  tStatus,
  locale,
}: {
  scope: StaffScope;
  t: TSecretariat;
  tCommon: TCommon;
  tSla: TSla;
  tTime: TTime;
  tExt: TExtRecipient;
  tStatus: TDocStatus;
  locale: LocaleShort;
}) {
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

  const withDgRows = withDg.map((d) => buildRow(d, 'with-dg', { t, tSla, tTime, tStatus, locale }));
  const dispatchedRows = dispatchedFromDg.map((d) =>
    buildRow(d, 'dispatched', { t, tSla, tTime, tStatus, locale }),
  );

  const overdue =
    withDgRows.filter((r) => r.sla.cls === 'red').length +
    dispatchedRows.filter((r) => r.sla.cls === 'red').length;
  const approaching =
    withDgRows.filter((r) => r.sla.cls === 'amber').length +
    dispatchedRows.filter((r) => r.sla.cls === 'amber').length;

  return (
    <>
      <PageHead kicker={t('subtitleFull')} title={t('title')} intro={t('introFull')} />

      <Kpis
        items={[
          { label: t('kpiAtDg'), num: withDg.length, hint: t('kpiAtDgHint') },
          { label: t('kpiDispatched'), num: dispatchedFromDg.length, hint: t('kpiDispatchedHint') },
          {
            label: t('kpiOverdue'),
            num: overdue,
            alert: overdue > 0,
            hint: overdue > 0 ? t('kpiOverdueHint') : t('kpiNoOverdue'),
          },
          {
            label: t('kpiApproaching'),
            num: approaching,
            warn: approaching > 0,
            hint: approaching > 0 ? t('kpiApproachingHint') : t('kpiNoApproaching'),
          },
        ]}
      />

      <Section
        title={t('secAtDgTitle', { count: withDgRows.length })}
        intro={t('secAtDgIntro')}
        rows={withDgRows}
        emptyHint={t('secAtDgEmpty')}
        t={t}
      />

      <Section
        title={t('secDispatchedTitle', { count: dispatchedRows.length })}
        intro={t('secDispatchedIntro')}
        rows={dispatchedRows}
        emptyHint={t('secDispatchedEmpty')}
        t={t}
      />
    </>
  );
}

// =============================================================================
//  B) SCOPED VIEW
// =============================================================================

async function ScopedView({
  scope,
  roleLabel: localizedRole,
  t,
  tCommon: _tCommon,
  tSla,
  tTime,
  tExt,
  tStatus,
  locale,
}: {
  scope: StaffScope;
  roleLabel: string;
  t: TSecretariat;
  tCommon: TCommon;
  tSla: TSla;
  tTime: TTime;
  tExt: TExtRecipient;
  tStatus: TDocStatus;
  locale: LocaleShort;
}) {
  const roles = scope.roleScope;

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
        currentHolderRole: { notIn: roles },
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

  const receivedRows = received.map((a) =>
    buildRow(
      { ...a.document, _refTime: a.assignedAt, _holderRoleOverride: a.assignedToRole },
      'received',
      { t, tSla, tTime, tStatus, locale },
    ),
  );

  const sentRows = sentDocs.map((d) => {
    const sentAt = d.handoffs[0]?.createdAt ?? d.updatedAt;
    const toRole = d.handoffs[0]?.toRole ?? d.currentHolderRole ?? null;
    return buildRow({ ...d, _refTime: sentAt, _sentToRoleOverride: toRole }, 'sent', {
      t,
      tSla,
      tTime,
      tStatus,
      locale,
    });
  });

  const externalRows: Row[] = externalTx.map((tx) => {
    const sla = computeSla(tx.sentAt, false, tSla, tTime);
    return {
      id: tx.id,
      reference: tx.document.reference,
      documentId: tx.document.id,
      subject: tx.document.subject,
      sender: tx.document.submission?.senderName ?? '—',
      senderOrg: tx.document.submission?.senderOrganization ?? null,
      counterparty: {
        label: tExt(tx.recipient) + (tx.recipientName ? ` · ${tx.recipientName}` : ''),
        role: null,
      },
      refTime: tx.sentAt,
      pill: { label: t('pendingLabel'), cls: 'ext-avis' },
      sla,
      status: 'AWAITING_EXTERNAL_AVIS' as DocumentStatus,
      kind: 'external',
      sentByName: tx.sentBy?.name ?? null,
      sentByRole: tx.sentBy?.staffRole ?? null,
    };
  });

  const overdue =
    receivedRows.filter((r) => r.sla.cls === 'red').length +
    sentRows.filter((r) => r.sla.cls === 'red').length;
  const approaching =
    receivedRows.filter((r) => r.sla.cls === 'amber').length +
    sentRows.filter((r) => r.sla.cls === 'amber').length;

  const subtreeBreadth = roles.length;
  const introScoped =
    subtreeBreadth === 1
      ? t('introScopedSingular', { count: subtreeBreadth })
      : t('introScopedPlural', { count: subtreeBreadth });

  return (
    <>
      <PageHead
        kicker={t('subtitleScoped', { role: localizedRole })}
        title={t('title')}
        intro={introScoped}
      />

      <Kpis
        items={[
          { label: t('kpiReceived'), num: receivedRows.length, hint: t('kpiReceivedHint') },
          { label: t('kpiSent'), num: sentRows.length, hint: t('kpiSentHint') },
          { label: t('kpiExternal'), num: externalRows.length, hint: t('kpiExternalHint') },
          {
            label: t('kpiOverdue'),
            num: overdue,
            alert: overdue > 0,
            warn: overdue === 0 && approaching > 0,
            hint:
              overdue > 0
                ? t('kpiOverdueHint')
                : approaching > 0
                  ? t('kpiApproachingHint')
                  : t('kpiNoOverdue'),
          },
        ]}
      />

      <Section
        title={t('secReceivedTitle', { count: receivedRows.length })}
        intro={t('secReceivedIntro')}
        rows={receivedRows}
        emptyHint={t('secReceivedEmpty')}
        t={t}
      />

      <Section
        title={t('secSentTitle', { count: sentRows.length })}
        intro={t('secSentIntro')}
        rows={sentRows}
        emptyHint={t('secSentEmpty')}
        t={t}
      />

      <Section
        title={t('secExternalTitle', { count: externalRows.length })}
        intro={t('secExternalIntro')}
        rows={externalRows}
        emptyHint={t('secExternalEmpty')}
        t={t}
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
  t,
}: {
  title: string;
  intro: string;
  rows: Row[];
  emptyHint: string;
  t: TSecretariat;
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

      <div className="v4-table v4-secretariat-table glass">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-[13px] italic text-ink-3">{emptyHint}</p>
          </div>
        ) : (
          <>
            <div className="v4-thead">
              <div>{t('colRefObject')}</div>
              <div>{t('colSender')}</div>
              <div>{counterpartyHeader(rows[0]?.kind, t)}</div>
              <div>{t('colStatus')}</div>
              <div>{t('colSla')}</div>
              <div>{t('colReminder')}</div>
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

function counterpartyHeader(kind: Row['kind'] | undefined, t: TSecretariat): string {
  switch (kind) {
    case 'with-dg':
      return t('colReceivedDate');
    case 'dispatched':
    case 'received':
      return t('colHolder');
    case 'sent':
      return t('colSentTo');
    case 'external':
      return t('colExternal');
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

type RowCtx = { t: TSecretariat; tSla: TSla; tTime: TTime; tStatus: TDocStatus; locale: LocaleShort };

function buildRow(d: RawDoc, kind: Row['kind'], ctx: RowCtx): Row {
  const refTime = d._refTime ?? d.updatedAt ?? d.submittedAt;
  const paused = d.status === 'AWAITING_EXTERNAL_AVIS';
  const sla = computeSla(refTime, paused, ctx.tSla, ctx.tTime);
  const pill = pillFor(d.status, ctx.tStatus);

  let counterpartyRole: StaffRole | null = null;
  let counterpartyLabel = '';
  switch (kind) {
    case 'with-dg':
      counterpartyLabel =
        refTime.toLocaleDateString(ctx.locale === 'en' ? 'en-GB' : 'fr-FR', {
          day: '2-digit',
          month: 'short',
        }) +
        ' · ' +
        refTime.toLocaleTimeString(ctx.locale === 'en' ? 'en-GB' : 'fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        });
      break;
    case 'dispatched':
    case 'received': {
      const role = d._holderRoleOverride ?? d.currentHolderRole;
      counterpartyRole = role ?? null;
      counterpartyLabel = role ? roleLabel(role, ctx.locale) : '—';
      break;
    }
    case 'sent': {
      const role = d._sentToRoleOverride ?? d.currentHolderRole;
      counterpartyRole = role ?? null;
      counterpartyLabel = role ? roleLabel(role, ctx.locale) : '—';
      break;
    }
    case 'external':
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
    counterparty:
      kind === 'with-dg' ? null : { label: counterpartyLabel, role: counterpartyRole },
    refTime,
    pill,
    sla,
    status: d.status,
    kind,
  };
}

function pillFor(status: DocumentStatus, tStatus: TDocStatus): { label: string; cls: string } {
  switch (status) {
    case 'AWAITING_DG_ANALYSIS':
      return { label: tStatus('AWAITING_DG_ANALYSIS'), cls: 'dg' };
    case 'AWAITING_DG_DECISION':
      return { label: tStatus('AWAITING_DG_DECISION'), cls: 'dg' };
    case 'ASSIGNED':
      return { label: tStatus('ASSIGNED'), cls: 'new' };
    case 'IN_TREATMENT':
      return { label: tStatus('IN_TREATMENT'), cls: 'in-treatment' };
    case 'AWAITING_EXTERNAL_AVIS':
      return { label: tStatus('AWAITING_EXTERNAL_AVIS'), cls: 'ext-avis' };
    default:
      return { label: status, cls: '' };
  }
}

function computeSla(
  referenceTime: Date,
  paused: boolean,
  tSla: TSla,
  tTime: TTime,
): { pct: number; cls: string; label: string } {
  if (paused) return { pct: 100, cls: 'paused', label: tSla('suspended') };
  const elapsed = Date.now() - referenceTime.getTime();
  const pct = Math.min(100, Math.max(2, Math.round((elapsed / SLA_TOTAL_MS) * 100)));
  const remaining = SLA_TOTAL_MS - elapsed;
  if (remaining < 0)
    return { pct, cls: 'red', label: tSla('overdue', { label: humanDuration(-remaining, tTime) }) };
  if (elapsed > SLA_RED_MS)
    return { pct, cls: 'red', label: tSla('remaining', { label: humanDuration(remaining, tTime) }) };
  if (elapsed > SLA_AMBER_MS)
    return { pct, cls: 'amber', label: tSla('remaining', { label: humanDuration(remaining, tTime) }) };
  return { pct, cls: '', label: tSla('remaining', { label: humanDuration(remaining, tTime) }) };
}

function humanDuration(ms: number, tTime: TTime): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const h = Math.floor(totalMin / 60);
  if (h < 1) return `${totalMin} ${tTime('minuteShort')}`;
  if (h < 24) {
    const min = totalMin % 60;
    return min === 0
      ? `${h} ${tTime('hourShort')}`
      : `${h} ${tTime('hourShort')} ${String(min).padStart(2, '0')}`;
  }
  const d = Math.floor(h / 24);
  return `${d} ${tTime('dayShort')}`;
}
