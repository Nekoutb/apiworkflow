import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/LogoutButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  // Bare paths — the next-intl middleware adds the locale prefix on redirect
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/dashboard');

  const t = await getTranslations('Admin');

  return (
    <div className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        {t('barLabel')}
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              {t('headerKicker')}
            </div>
            <div className="serif text-[17px] font-bold text-ink">{t('headerSubtitle')}</div>
          </div>
          <nav className="ml-8 hidden gap-6 md:flex">
            <Link
              href="/dashboard"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
            >
              {t('navDashboard')}
            </Link>
            <Link
              href="/admin/users"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
            >
              {t('navUsers')}
            </Link>
            <Link
              href="/admin/data"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
            >
              {t('navData')}
            </Link>
            <Link
              href="/admin/audit"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
            >
              {t('navAudit')}
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <LanguageSwitcher variant="compact" />
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">
                {session.user.name ?? session.user.email}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
                {t('roleAdmin')}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
