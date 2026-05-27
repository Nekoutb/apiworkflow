import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

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
    <main className="relative flex h-screen flex-col overflow-hidden bg-gradient-to-b from-white via-[#f3f8f5] to-[#e8f1ec]">
      {/* Subtle radial glow + dot grid (kept) */}
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

      {/* Official obsidian banner — sets the "internal / restricted" tone */}
      <div className="relative z-10 flex flex-shrink-0 items-center justify-center gap-3 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span>
        {t('officialBanner')}
        <span className="text-gold-500">⚜</span>
      </div>

      {/* Header — logo + language switcher */}
      <header className="relative z-10 flex flex-shrink-0 items-center justify-between border-b border-line bg-white/80 px-14 py-4 backdrop-blur">
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500">
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
        </div>
        <LanguageSwitcher variant="editorial" />
      </header>

      {/* Main — centred, fills remaining viewport */}
      <section className="relative z-10 flex flex-1 items-center px-14 py-8">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[1.5fr_0.6fr] gap-14">
          {/* Left — eyebrow + tagline + subtitle + CTA + restricted-access notice */}
          <div className="flex flex-col justify-center">
            <div className="mb-4 inline-flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-gold-700">
              {t('internalPortalBadge')}
              <span className="h-px w-11 bg-gold-600" />
            </div>

            <h1 className="serif mb-5 max-w-[680px] text-[clamp(36px,4.2vw,52px)] font-semibold leading-[1.08] tracking-[-0.02em] text-ink">
              {t('tagline')}
            </h1>

            <p className="mb-7 max-w-[560px] text-[15px] leading-[1.6] text-ink-2">
              {t('subtitle')}
            </p>

            {/* Primary CTA — restricted-access login */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 border-2 border-obsidian bg-obsidian px-6 py-3 text-[12px] font-bold uppercase tracking-[0.16em] text-gold-500 transition hover:bg-ink hover:gap-3"
              >
                🔐 {t('ctaLogin')}
                <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-cmred">
                ⚠ {t('restrictedAccess')}
              </div>
            </div>

            <div className="serif mt-8 inline-flex items-center gap-2.5 border-l-2 border-gold-600 pl-4 text-[13.5px] italic text-gold-700">
              « {t('quote')} »
            </div>
          </div>

          {/* Right — three compact stats stacked */}
          <aside className="flex flex-col justify-center border-l border-line pl-12">
            <Stat num="7"  label={t('phasesLabel')} />
            <Stat num="37" label={t('rolesLabel')} />
            <Stat num="II" unit={locale === 'en' ? 'languages' : 'langues'} label="Français · English" last />
          </aside>
        </div>
      </section>

      {/* Footer — minimal seal + note */}
      <footer className="relative z-10 flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line bg-obsidian px-14 py-3 text-[10px] uppercase tracking-[0.16em] text-white/65">
        <div className="flex items-center gap-2">
          <span className="text-gold-500">⚜</span>
          <span className="font-bold text-white">{tCommon('appName')}</span>
          <span className="text-gold-500">⚜</span>
          <span className="ml-3 text-white/45">{tCommon('republic')}</span>
        </div>
        <div className="text-white/55 italic normal-case tracking-normal text-[10.5px]">
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
    <div className={last ? 'py-4' : 'border-b border-line py-4'}>
      <div className="flex items-baseline gap-1.5">
        <span className="serif text-[40px] font-semibold leading-none tracking-[-0.02em] text-cmgreen-800">
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
