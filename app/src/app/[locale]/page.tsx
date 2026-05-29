import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AppLogo } from '@/components/AppLogo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('homeTitle'), description: t('homeDescription') };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t       = await getTranslations('Home');
  const tCommon = await getTranslations('Common');

  return (
    <main className="relative flex h-screen flex-col overflow-hidden">
      {/* Official obsidian banner */}
      <div className="relative z-10 flex flex-shrink-0 items-center justify-center gap-3 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span>
        {t('officialBanner')}
        <span className="text-gold-500">⚜</span>
      </div>

      {/* Glass header */}
      <header className="glass glass-hi relative z-10 mx-3 mt-3 flex flex-shrink-0 items-center justify-between rounded-2xl px-6 py-3 sm:px-8">
        <div className="flex items-center gap-3.5">
          <AppLogo size="md" asLink={false} />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              {tCommon('republic')}
            </div>
            <div className="text-[15px] font-bold text-navy sm:text-[17px]">
              {tCommon('appNameLong')}
            </div>
          </div>
        </div>
        <LanguageSwitcher variant="editorial" />
      </header>

      {/* Main — editorial split, on the global aurora backdrop */}
      <section className="relative z-10 flex flex-1 items-center px-5 py-6 sm:px-10">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 md:grid-cols-[1.5fr_0.7fr] md:gap-14">
          {/* Left — eyebrow + tagline + subtitle + CTA */}
          <div className="flex flex-col justify-center">
            <div className="mb-4 inline-flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-blue-700">
              {t('internalPortalBadge')}
              <span className="h-px w-11 bg-blue-600/60" />
            </div>

            <h1 className="mb-5 max-w-[680px] text-[clamp(34px,4.4vw,52px)] font-bold leading-[1.07] tracking-[-0.02em] text-navy">
              {t('tagline')}
            </h1>

            <p className="mb-7 max-w-[560px] text-[15px] leading-[1.6] text-ink-2">
              {t('subtitle')}
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[13px] font-semibold text-white shadow-[0_8px_22px_rgba(43,126,201,0.4)] transition hover:gap-3"
                style={{ background: 'linear-gradient(135deg,#52a8ec,#2b7ec9 70%,#10355c)' }}
              >
                🔐 {t('ctaLogin')}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-cmred">
                ⚠ {t('restrictedAccess')}
              </div>
            </div>

            <div className="mt-8 inline-flex items-center gap-2.5 border-l-2 border-blue-500/70 pl-4 text-[13.5px] italic text-ink-3">
              « {t('quote')} »
            </div>
          </div>

          {/* Right — stats in a glass card */}
          <aside className="glass glass-hi flex flex-col gap-1 rounded-2xl p-7">
            <Stat num="7"  label={t('phasesLabel')} />
            <Stat num="37" label={t('rolesLabel')} />
            <Stat num="II" unit={locale === 'en' ? 'languages' : 'langues'} label="Français · English" last />
          </aside>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-3 bg-obsidian px-7 py-3 text-[10px] uppercase tracking-[0.16em] text-white/65 sm:px-14">
        <div className="flex items-center gap-2">
          <span className="text-gold-500">⚜</span>
          <span className="font-bold text-white">{tCommon('appName')}</span>
          <span className="text-gold-500">⚜</span>
          <span className="ml-3 text-white/45">{tCommon('republic')}</span>
        </div>
        <div className="text-[10.5px] italic normal-case tracking-normal text-white/55">
          {t('footerNote')}
        </div>
        <div className="text-white/45">© MMXXVI</div>
      </footer>
    </main>
  );
}

function Stat({
  num,
  unit,
  label,
  last,
}: {
  num: string;
  unit?: string;
  label: string;
  last?: boolean;
}) {
  return (
    <div className={last ? 'py-3.5' : 'border-b border-blue-200/50 py-3.5'}>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[40px] font-bold leading-none tracking-[-0.02em] text-blue-700">
          {num}
        </span>
        {unit ? <span className="text-[13px] font-medium italic text-ink-4">{unit}</span> : null}
      </div>
      <div className="mt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
        {label}
      </div>
    </div>
  );
}
