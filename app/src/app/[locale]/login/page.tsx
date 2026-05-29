import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AppLogo } from '@/components/AppLogo';
import { LoginForm } from './LoginForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('loginTitle') };
}

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  if (session?.user) redirect('/post-login');

  const t = await getTranslations('Login');
  const tCommon = await getTranslations('Common');
  const tHome = await getTranslations('Home');

  return (
    <main className="relative min-h-screen">
      {/* gov bar */}
      <div className="relative z-10 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        {tCommon('republic')} <span className="mx-3 text-gold-500">⚜</span> {tCommon('appNameLong')}
      </div>

      <div className="relative z-10 grid min-h-[calc(100vh-26px)] items-stretch gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        {/* LEFT — brand panel on the aurora backdrop */}
        <aside className="flex flex-col justify-between px-8 py-10 sm:px-14 sm:py-14">
          <Link href="/" className="flex items-center gap-3.5">
            <AppLogo size="md" asLink={false} />
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
                {tCommon('republic')}
              </div>
              <div className="text-[16px] font-bold text-navy sm:text-[17px]">
                {tCommon('appNameLong')}
              </div>
            </div>
          </Link>

          <div className="my-10 max-w-[480px] lg:my-0">
            <div className="mb-5 inline-flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-blue-700">
              {tCommon('officialPortal')}
              <span className="h-px w-11 bg-blue-600/60" />
            </div>
            <h1 className="mb-5 text-[clamp(34px,4vw,50px)] font-bold leading-[1.07] tracking-[-0.02em] text-navy">
              {t('officialCircuit')}
            </h1>
            <p className="max-w-[420px] text-[14.5px] leading-[1.65] text-ink-2">
              {tHome('subtitle')}
            </p>
          </div>

          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-ink-3">
            <span>{t('copyright')}</span>
            <LanguageSwitcher variant="editorial" />
          </div>
        </aside>

        {/* RIGHT — glass sign-in card */}
        <section className="flex items-center justify-center px-5 py-10 sm:px-8 sm:py-16">
          <div className="glass glass-hi w-full max-w-[440px] rounded-2xl p-8 sm:p-10">
            <div className="mb-5 flex justify-center">
              <AppLogo size="lg" asLink={false} />
            </div>
            <div className="mb-1.5 text-center text-[10.5px] font-semibold uppercase tracking-[0.24em] text-blue-700">
              {t('panelHeading')}
            </div>
            <h2 className="mb-2 text-center text-[28px] font-bold tracking-[-0.4px] text-navy">
              {t('title')}
            </h2>
            <p className="mb-7 text-center text-[13.5px] italic text-ink-3">
              {t('subtitle')}
            </p>

            <LoginForm />

            <div className="mt-7 border-t border-line/70 pt-5 text-center">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-4">
                {t('devModeHeading')}
              </p>
              <p
                className="mt-1.5 text-[13px] italic text-ink-3"
                dangerouslySetInnerHTML={{
                  __html: t
                    .raw('devModeAccounts')
                    .replace(/<bold>/g, '<strong class="font-mono not-italic text-navy">')
                    .replace(/<\/bold>/g, '</strong>'),
                }}
              />
              <p
                className="mt-1 text-[13px] italic text-ink-3"
                dangerouslySetInnerHTML={{
                  __html: t
                    .raw('devModePassword')
                    .replace(/<bold>/g, '<strong class="font-mono not-italic text-navy">')
                    .replace(/<\/bold>/g, '</strong>'),
                }}
              />
            </div>

            <div className="mt-4 text-center">
              <Link href="/" className="text-[11px] uppercase tracking-[0.14em] text-ink-3 hover:text-navy">
                ← {t('backToHome')}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
