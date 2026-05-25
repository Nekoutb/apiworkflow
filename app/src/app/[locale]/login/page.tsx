import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { auth } from '@/lib/auth';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
    <main className="min-h-screen bg-bgsoft">
      {/* gov bar */}
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        {tCommon('republic')} <span className="mx-3 text-gold-500">⚜</span> {tCommon('appNameLong')}
      </div>

      <div className="grid min-h-[calc(100vh-26px)] lg:grid-cols-[1.05fr_0.95fr]">
        {/* ====== LEFT: editorial brand panel ====== */}
        <aside className="relative overflow-hidden bg-gradient-to-b from-white via-[#f3f8f5] to-[#e8f1ec] px-14 py-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse 60% 40% at 85% 0%, rgba(193, 151, 63, 0.10) 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 0% 100%, rgba(0, 107, 58, 0.08) 0%, transparent 55%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(rgba(12, 18, 32, 0.03) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          />

          <div className="relative flex h-full flex-col justify-between">
            {/* crest */}
            <Link href="/" className="flex items-center gap-3.5">
              <div className="relative flex h-12 w-12 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500">
                A
                <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
                  {tCommon('republic')}
                </div>
                <div className="serif text-[17px] font-bold text-ink">
                  {tCommon('appNameLong')}
                </div>
              </div>
            </Link>

            {/* hero copy */}
            <div className="max-w-[480px]">
              <div className="mb-5 inline-flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-gold-700">
                {tCommon('officialPortal')}
                <span className="h-px w-11 bg-gold-600" />
              </div>
              <h1 className="serif mb-5 text-[clamp(36px,4vw,52px)] font-semibold leading-[1.06] tracking-[-0.022em] text-ink">
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
          </div>
        </aside>

        {/* ====== RIGHT: sign-in card ====== */}
        <section className="flex items-center justify-center bg-white px-8 py-16">
          <div className="w-full max-w-[420px]">
            <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
              {t('panelHeading')}
            </div>
            <h2 className="serif mb-2 text-[28px] font-semibold tracking-[-0.4px] text-ink">
              {t('title')}
            </h2>
            <p className="serif mb-7 text-[13.5px] italic text-ink-3">
              {t('subtitle')}
            </p>

            <LoginForm />

            <div className="mt-7 border-t border-line pt-5 text-center">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-4">
                {t('devModeHeading')}
              </p>
              <p
                className="serif mt-1.5 text-[13px] italic text-ink-3"
                dangerouslySetInnerHTML={{
                  __html: t
                    .raw('devModeAccounts')
                    .replace(/<bold>/g, '<strong class="font-mono not-italic text-ink">')
                    .replace(/<\/bold>/g, '</strong>'),
                }}
              />
              <p
                className="serif mt-1 text-[13px] italic text-ink-3"
                dangerouslySetInnerHTML={{
                  __html: t
                    .raw('devModePassword')
                    .replace(/<bold>/g, '<strong class="font-mono not-italic text-ink">')
                    .replace(/<\/bold>/g, '</strong>'),
                }}
              />
            </div>

            <div className="mt-4 text-center">
              <Link href="/" className="text-[11px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink">
                ← {t('backToHome')}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
