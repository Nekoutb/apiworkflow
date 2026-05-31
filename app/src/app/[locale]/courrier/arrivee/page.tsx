import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import { isClaudeConfigured } from '@/lib/claude';
import type { StaffRole } from '@prisma/client';
import { RegisterForm } from './RegisterForm';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';

export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = ['ADMIN', 'CHEF_BUREAU_ARRIVEE', 'CHEF_SERVICE_COURRIER'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('courrierArriveeTitle') };
}

export default async function CourrierArriveePage({
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

  const t = await getTranslations('CourrierArrivee');
  const tCommon = await getTranslations('Common');
  const tDashboard = await getTranslations('Dashboard');
  const tStatus = await getTranslations('DocStatus');
  const tNature = await getTranslations('DocNature');
  const tChannel = await getTranslations('SourceChannel');
  const localeShort = locale === 'en' ? 'en' : 'fr';

  // Recent documents registered by Bureau Arrivée (last 30 days, any status)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [recent, todayCount, weekCount, monthCount] = await Promise.all([
    db.document.findMany({
      where: { submittedAt: { gte: since } },
      orderBy: { submittedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        status: true,
        sourceChannel: true,
        submittedAt: true,
        currentHolderRole: true,
        submission: { select: { senderName: true, senderEmail: true, senderOrganization: true } },
      },
    }),
    db.document.count({
      where: { submittedAt: { gte: startOfDayUTC() } },
    }),
    db.document.count({
      where: { submittedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    db.document.count({
      where: { submittedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return (
    <main className="min-h-screen bg-bgsoft">
      {/* gov bar */}
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        {tCommon('internalPortal')} <span className="mx-3 text-gold-500">⚜</span>
        {t('kicker').replace(tCommon('internalPortal') + ' · ', '')} <span className="mx-3 text-gold-500">⚜</span>
        {t('title').split(' — ')[0]}
      </div>

      {/* header */}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              {t('kicker')}
            </div>
            <div className="serif text-[17px] font-bold text-ink">{t('title')}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">{session.user.name ?? session.user.email}</div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleLabel(role, localeShort)}</div>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={tCommon('today')} value={todayCount} />
          <Stat label={tCommon('last7days')} value={weekCount} />
          <Stat label={tCommon('last30days')} value={monthCount} />
          <Stat label={tCommon('reference')} value="COURRIER-2026" mono small />
        </div>

        {/* Registration form */}
        <div className="mt-10">
          <h2 className="serif mb-3 text-[22px] font-semibold tracking-[-0.3px] text-ink">
            {t('newDocumentHeading')}
          </h2>
          <p className="serif mb-6 text-[13.5px] italic text-ink-3">
            {t('newDocumentIntro')}
          </p>
          <RegisterForm aiEnabled={isClaudeConfigured()} />
        </div>

        {/* Recent documents */}
        <h2 className="serif mb-3 mt-14 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          {t('recentHeading')}
        </h2>
        {recent.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            {t('recentEmpty')}
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full">
              <thead className="bg-bgsoft">
                <tr className="text-left">
                  <Th>{tCommon('reference')}</Th>
                  <Th>{tCommon('sender')}</Th>
                  <Th>{tCommon('subject')}</Th>
                  <Th>{tCommon('nature')}</Th>
                  <Th>{tCommon('channel')}</Th>
                  <Th>{tCommon('status')}</Th>
                  <Th>{tCommon('receivedOn')}</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">
                      {d.reference}
                    </td>
                    <td className="px-4 py-3 text-[12.5px]">
                      <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                      <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                      {d.submission?.senderOrganization && (
                        <div className="text-[10.5px] italic text-ink-4">{d.submission.senderOrganization}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-2">
                      <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-ink-3">
                      {tNature(d.nature)}
                    </td>
                    <td className="px-4 py-3 text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
                      {tChannel((d.sourceChannel + '_SHORT') as 'ONLINE_SHORT' | 'COURRIER_PHYSICAL_SHORT' | 'ANTENNE_SHORT')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-gold-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gold-700">
                        {tStatus(d.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {d.submittedAt.toLocaleString(localeShort === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                  </tr>
                ))}
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

function Stat({ label, value, mono, small }: { label: string; value: string | number; mono?: boolean; small?: boolean }) {
  return (
    <div className="border border-line bg-white px-4 py-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div
        className={
          'mt-1 font-semibold text-ink ' +
          (small ? 'text-[14px]' : 'text-[24px]') + ' ' +
          (mono ? 'font-mono tracking-tight' : '')
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
