import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';

export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = ['DG', 'DGA', 'ADMIN'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('dgParapheurTitle') };
}

export default async function DgParapheurPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || !ALLOWED.includes(role)) redirect('/dashboard');

  const t = await getTranslations('DgParapheur');
  const tCommon = await getTranslations('Common');
  const tNature = await getTranslations('DocNature');
  const localeShort = locale === 'en' ? 'en' : 'fr';

  const [pending, awaitingDecision, processedToday, oldestWaiting, totalProcessed] = await Promise.all([
    db.document.findMany({
      where: { status: 'AWAITING_DG_ANALYSIS' },
      orderBy: { submittedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        submittedAt: true,
        submission: {
          select: { senderName: true, senderEmail: true, senderOrganization: true, senderType: true },
        },
        aiAnalyses: {
          where: { kind: 'ASSIGNMENT_SUGGESTION' },
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: { id: true, summary: true, generatedAt: true, contentJson: true },
        },
      },
    }),
    db.document.findMany({
      where: { status: 'AWAITING_DG_DECISION' },
      orderBy: { updatedAt: 'asc' },
      take: 100,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        submittedAt: true,
        updatedAt: true,
        submission: {
          select: { senderName: true, senderEmail: true, senderOrganization: true },
        },
        handoffs: {
          where: { type: 'RETURN_TO_DG' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { fromRole: true, createdAt: true, fromUser: { select: { name: true, email: true } } },
        },
      },
    }),
    db.document.count({
      where: {
        OR: [
          { dispatchedAt: { gte: startOfDayUTC() } },
          { status: { in: ['ASSIGNED', 'IN_TREATMENT', 'DECIDED', 'RESPONSE_SENT', 'CLOSED'] } },
        ],
        dispatchedAt: { gte: startOfDayUTC() },
      },
    }),
    db.document.findFirst({
      where: { status: 'AWAITING_DG_ANALYSIS' },
      orderBy: { submittedAt: 'asc' },
      select: { submittedAt: true },
    }),
    db.document.count({
      where: { status: { not: 'AWAITING_DG_ANALYSIS' } },
    }),
  ]);

  const oldestAgeMs = oldestWaiting ? Date.now() - oldestWaiting.submittedAt.getTime() : 0;

  // i18n bits not in the namespace (small, page-specific)
  const isEn = localeShort === 'en';
  const labelPendingAnalysis = isEn ? 'Awaiting analysis' : "En attente d'analyse";
  const labelPendingDecision = isEn ? 'Awaiting decision' : 'En attente de décision';
  const labelOldest = isEn ? 'Oldest in queue' : 'Doyen en file';
  const labelTotal = isEn ? 'Total processed' : 'Total traités';
  const labelPanelAnalysis = isEn ? 'Documents awaiting analysis' : "Documents en attente d'analyse";
  const labelPanelDecision = isEn ? 'Dossiers awaiting GM decision' : 'Dossiers en attente de décision DG';
  const introAnalysis = isEn
    ? "Documents handed in by the Mail Service · Incoming Mail Office, oldest first. Click a row to open the AI analysis and dispatch."
    : "Documents transmis par le Service du Courrier · Bureau Arrivée, triés du plus ancien au plus récent. Cliquez sur un document pour ouvrir l'analyse + dispatcher.";
  const introDecision = isEn
    ? "Documents that Directors processed and submitted to the GM for final decision (approval or rejection). Once decided, the dossier moves to the Outgoing Mail Office for response dispatch."
    : "Documents que les Directeurs ont traités et soumis au DG pour décision finale (approbation ou rejet). Une fois la décision rendue, le dossier file au Bureau Départ pour expédition de la réponse.";
  const emptyAnalysis = isEn
    ? "No document pending. The folder fills as soon as a letter is registered at the Incoming Mail Office."
    : "Aucun document en attente. Le parapheur se remplit dès qu'un courrier est enregistré au Bureau Arrivée.";
  const emptyDecision = isEn
    ? "No dossier awaiting decision. This queue fills as soon as a Director submits a processed dossier."
    : "Aucun dossier en attente de décision. Cette file se remplit dès qu'un Directeur soumet un dossier traité.";
  const colAge = isEn ? 'Age' : 'Âge';
  const colAi = isEn ? 'AI' : 'IA';
  const colSubmittedBy = isEn ? 'Submitted by' : 'Soumis par';
  const colDecisionAge = isEn ? 'Decision age' : 'Âge décision';
  const labelAnalysed = isEn ? '✨ Analysed' : '✨ Analysé';
  const labelDecide = isEn ? 'Decide →' : 'Décider →';

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        {tCommon('internalPortal')} <span className="mx-3 text-gold-500">⚜</span>
        {isEn ? 'General Management' : 'Direction Générale'} <span className="mx-3 text-gold-500">⚜</span>
        {t('title')}
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              {tCommon('internalPortal')} · {isEn ? 'General Management' : 'Direction Générale'}
            </div>
            <div className="serif text-[17px] font-bold text-ink">
              {t('title')} — {t('subtitle')}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">
                {session.user.name ?? session.user.email}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
                {roleLabel(role, localeShort)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-6">
        <Link
          href="/dashboard"
          className="mb-5 inline-flex items-center text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-3 transition hover:text-ink"
        >
          {tCommon('backToDashboard')}
        </Link>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={labelPendingAnalysis} value={pending.length} accent />
          <Stat label={labelPendingDecision} value={awaitingDecision.length} accent={awaitingDecision.length > 0} urgent={awaitingDecision.length > 0} />
          <Stat label={labelOldest} value={oldestWaiting ? humanAge(oldestAgeMs, isEn) : '—'} mono />
          <Stat label={labelTotal} value={totalProcessed} />
        </div>

        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          {labelPanelAnalysis}
        </h2>
        <p className="serif mb-4 text-[12.5px] italic text-ink-3">{introAnalysis}</p>

        {pending.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            {emptyAnalysis}
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full">
              <thead className="bg-bgsoft">
                <tr className="text-left">
                  <Th>{colAge}</Th>
                  <Th>{tCommon('reference')}</Th>
                  <Th>{tCommon('sender')}</Th>
                  <Th>{tCommon('subject')}</Th>
                  <Th>{tCommon('nature')}</Th>
                  <Th>{colAi}</Th>
                  <Th>{tCommon('actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {pending.map((d) => {
                  const ageMs = Date.now() - d.submittedAt.getTime();
                  const ageClass =
                    ageMs > 7 * 24 * 60 * 60 * 1000 ? 'text-cmred' :
                    ageMs > 3 * 24 * 60 * 60 * 1000 ? 'text-gold-700' :
                    'text-ink-3';
                  const cached = d.aiAnalyses[0];
                  return (
                    <tr key={d.id} className="border-t border-line align-top">
                      <td className={'px-4 py-3 font-mono text-[11px] font-semibold ' + ageClass}>
                        {humanAge(ageMs, isEn)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">
                        {d.reference}
                      </td>
                      <td className="px-4 py-3 text-[12.5px]">
                        <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                        <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                        {d.submission?.senderOrganization && (
                          <div className="text-[10.5px] italic text-ink-4">
                            {d.submission.senderOrganization}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-2">
                        <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-3">
                        {tNature(d.nature)}
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        {cached ? (
                          <span className="inline-block bg-cmgreen-50 px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-cmgreen-900">
                            {labelAnalysed}
                          </span>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dg/parapheur/${d.id}`}
                          className="bg-blue-700 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-blue-800"
                        >
                          {t('openButton')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Decisions awaiting DG ruling */}
        <h2 className="serif mb-3 mt-16 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          {labelPanelDecision}
        </h2>
        <p className="serif mb-4 text-[12.5px] italic text-ink-3">{introDecision}</p>

        {awaitingDecision.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            {emptyDecision}
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full">
              <thead className="bg-bgsoft">
                <tr className="text-left">
                  <Th>{colDecisionAge}</Th>
                  <Th>{tCommon('reference')}</Th>
                  <Th>{tCommon('sender')}</Th>
                  <Th>{tCommon('subject')}</Th>
                  <Th>{tCommon('nature')}</Th>
                  <Th>{colSubmittedBy}</Th>
                  <Th>{tCommon('actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {awaitingDecision.map((d) => {
                  const submitted = d.handoffs[0];
                  const submittedAt = submitted?.createdAt ?? d.updatedAt;
                  const ageMs = Date.now() - submittedAt.getTime();
                  const ageClass =
                    ageMs > 7 * 24 * 60 * 60 * 1000 ? 'text-cmred' :
                    ageMs > 3 * 24 * 60 * 60 * 1000 ? 'text-gold-700' :
                    'text-ink-3';
                  return (
                    <tr key={d.id} className="border-t border-line align-top">
                      <td className={'px-4 py-3 font-mono text-[11px] font-semibold ' + ageClass}>
                        {humanAge(ageMs, isEn)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">
                        {d.reference}
                      </td>
                      <td className="px-4 py-3 text-[12.5px]">
                        <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                        <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                        {d.submission?.senderOrganization && (
                          <div className="text-[10.5px] italic text-ink-4">
                            {d.submission.senderOrganization}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-2">
                        <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-3">
                        {tNature(d.nature)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-3">
                        <div className="font-semibold text-ink-2">
                          {submitted?.fromRole ? roleLabel(submitted.fromRole, localeShort) : '—'}
                        </div>
                        {submitted?.fromUser && (
                          <div className="text-[10.5px] italic text-ink-4">
                            {submitted.fromUser.name ?? submitted.fromUser.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dg/parapheur/${d.id}`}
                          className="bg-blue-700 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-blue-800"
                        >
                          {labelDecide}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            {tCommon('backToDashboard')}
          </Link>
        </div>
      </section>
    </main>
  );
}

function startOfDayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function humanAge(ms: number, isEn: boolean): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} ${isEn ? 'd' : 'j'}`;
  const mo = Math.floor(d / 30);
  return `${mo} ${isEn ? 'mo' : 'mois'}`;
}

function Stat({
  label, value, accent, mono, urgent,
}: {
  label: string; value: number | string; accent?: boolean; mono?: boolean; urgent?: boolean;
}) {
  return (
    <div
      className={
        'border bg-white px-4 py-3.5 ' +
        (urgent ? 'border-gold-700' : accent ? 'border-cmgreen-700' : 'border-line')
      }
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div
        className={
          'mt-1 text-[24px] font-semibold ' +
          (urgent ? 'text-gold-700' : accent ? 'text-cmgreen-900' : 'text-ink') + ' ' +
          (mono ? 'font-mono' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
      {children}
    </th>
  );
}
