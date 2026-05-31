import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isStaffRole, roleLabel } from '@/lib/roles';
import { AppLogo } from '@/components/AppLogo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoutButton } from '@/components/LogoutButton';
import { NotificationBell } from '@/components/NotificationBell';
import { LanguageCard } from './LanguageCard';
import { PasswordCard } from './PasswordCard';

export const dynamic = 'force-dynamic';

const BUILD_COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? 'dev';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('settingsTitle') };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (!isStaffRole(role)) redirect('/login');

  const t = await getTranslations('Settings');
  const tCommon = await getTranslations('Common');
  const tDashboard = await getTranslations('Dashboard');
  const localeShort = locale === 'en' ? 'en' : 'fr';
  const userId = (session.user as { id?: string }).id;

  const user = userId
    ? await db.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          createdAt: true,
          lastLoginAt: true,
          antenne: { select: { name: true } },
        },
      })
    : null;

  const dtLocale = localeShort === 'en' ? 'en-GB' : 'fr-FR';
  const fmtDate = (d: Date | null | undefined) =>
    d ? d.toLocaleString(dtLocale, { dateStyle: 'long', timeStyle: 'short' }) : '—';

  return (
    <main className="relative min-h-screen">
      <div className="relative z-10 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span> {tCommon('internalPortal')} · {t('title')}{' '}
        <span className="text-gold-500">⚜</span>
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
            {t('title')}
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
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
              {roleLabel(role, localeShort)}
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="relative z-10 mx-auto max-w-3xl px-5 py-6 sm:px-7 sm:py-10">
        <div className="v4-page-head">
          <div className="kicker">
            <span className="dot" />
            {roleLabel(role, localeShort)}
          </div>
          <h1>{t('title')}</h1>
          <p>{t('subtitle')}</p>
        </div>

        <div className="space-y-5">
          {/* Profile */}
          <Card title={t('sectionProfile')}>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <Row k={t('profileName')} v={user?.name ?? session.user.name ?? '—'} />
              <Row k={t('profileEmail')} v={user?.email ?? session.user.email ?? '—'} mono />
              <Row k={t('profileRole')} v={roleLabel(role, localeShort)} />
              <Row k={t('profileAntenne')} v={user?.antenne?.name ?? '—'} />
              <Row k={t('profileLastLogin')} v={fmtDate(user?.lastLoginAt)} />
              <Row k={t('profileMemberSince')} v={fmtDate(user?.createdAt)} />
            </dl>
          </Card>

          {/* Language */}
          <Card title={t('sectionLanguage')} hint={t('sectionLanguageHint')}>
            <LanguageCard />
          </Card>

          {/* Security */}
          <Card title={t('sectionSecurity')} hint={t('sectionSecurityHint')}>
            <PasswordCard />
          </Card>

          {/* About */}
          <Card title={t('sectionAbout')}>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <Row k={t('aboutVersion')} v="v2" />
              <Row k={t('aboutCommit')} v={BUILD_COMMIT.slice(0, 7)} mono />
            </dl>
          </Card>
        </div>
      </section>
    </main>
  );
}

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <h2
        className="text-[15px] font-bold text-navy"
        style={{ fontFamily: "var(--font-display), 'Lexend', sans-serif" }}
      >
        {title}
      </h2>
      {hint && <p className="mt-1 mb-4 text-[12px] italic text-ink-3">{hint}</p>}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{k}</dt>
      <dd className={'mt-0.5 text-[13.5px] text-ink ' + (mono ? 'font-mono text-[12.5px]' : '')}>{v}</dd>
    </div>
  );
}
