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

const ALLOWED: StaffRole[] = ['ADMIN', 'CHEF_BUREAU_DEPART', 'CHEF_SERVICE_COURRIER'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('courrierDepartTitle') };
}

export default async function CourrierDepartPage({
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

  const t = await getTranslations('CourrierDepart');
  const tCommon = await getTranslations('Common');
  const tStatus = await getTranslations('DocStatus');
  const tNature = await getTranslations('DocNature');
  const localeShort = locale === 'en' ? 'en' : 'fr';

  // Awaiting outbound = status DECIDED
  // Recent outbound = status RESPONSE_SENT over the last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [awaiting, recent, todayCount] = await Promise.all([
    db.document.findMany({
      where: { status: 'DECIDED' },
      orderBy: { decidedAt: 'asc' },
      take: 50,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        decidedAt: true,
        submission: {
          select: { senderName: true, senderEmail: true, senderOrganization: true },
        },
      },
    }),
    db.document.findMany({
      where: { status: 'RESPONSE_SENT', responseSentAt: { gte: since } },
      orderBy: { responseSentAt: 'desc' },
      take: 30,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        responseSentAt: true,
        submission: { select: { senderName: true, senderEmail: true } },
      },
    }),
    db.document.count({
      where: { responseSentAt: { gte: startOfDayUTC() } },
    }),
  ]);

  const headingAwaiting = localeShort === 'en' ? 'Decisions ready to dispatch' : 'Décisions prêtes à expédier';
  const headingRecent = localeShort === 'en' ? 'Recently dispatched' : 'Récemment expédiés';
  const statAwaiting = localeShort === 'en' ? 'Awaiting dispatch' : "En attente d'expédition";
  const statToday = localeShort === 'en' ? 'Dispatched today' : "Expédiés aujourd'hui";
  const statRecent = localeShort === 'en' ? 'Dispatched (30 days)' : 'Expédiés (30 jours)';

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        {tCommon('internalPortal')} <span className="mx-3 text-gold-500">⚜</span>
        {t('title')}
      </div>

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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label={statAwaiting} value={awaiting.length} accent />
          <Stat label={statToday} value={todayCount} />
          <Stat label={statRecent} value={recent.length} />
        </div>

        {/* Awaiting outbound */}
        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          {headingAwaiting}
        </h2>
        {awaiting.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            {t('empty')}
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
                  <Th>{t('colDecidedAt')}</Th>
                  <Th>{tCommon('actions')}</Th>
                </tr>
              </thead>
              <tbody>
                {awaiting.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">{d.reference}</td>
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
                    <td className="px-4 py-3 text-[11.5px] text-ink-3">{tNature(d.nature)}</td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {d.decidedAt?.toLocaleString(localeShort === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' }) ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/courrier/depart/${d.id}`}
                        className="bg-blue-700 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-blue-800"
                      >
                        {localeShort === 'en' ? 'Compose →' : 'Composer →'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Recent outbound */}
        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          {headingRecent}
        </h2>
        {recent.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            {tCommon('noResults')}
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full">
              <thead className="bg-bgsoft">
                <tr className="text-left">
                  <Th>{tCommon('reference')}</Th>
                  <Th>{tCommon('sender')}</Th>
                  <Th>{tCommon('subject')}</Th>
                  <Th>{tCommon('sentOn')}</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">{d.reference}</td>
                    <td className="px-4 py-3 text-[12.5px]">
                      <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                      <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-2">
                      <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {d.responseSentAt?.toLocaleString(localeShort === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'short', timeStyle: 'short' }) ?? '—'}
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

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={'border bg-white px-4 py-3.5 ' + (accent ? 'border-cmgreen-700' : 'border-line')}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div className={'mt-1 text-[24px] font-semibold ' + (accent ? 'text-cmgreen-900' : 'text-ink')}>
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
