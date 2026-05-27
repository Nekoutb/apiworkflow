import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import Image from 'next/image';
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
    <main
      className="relative flex h-screen flex-col overflow-hidden"
      // Microsoft-style soft pastel swirl — 6 layered diffuse blobs over a
      // near-white linear wash. Done as an inline style so we don't need to
      // teach Tailwind a custom keyframe.
      style={{
        background: [
          'radial-gradient(ellipse 50% 40% at 15% 25%, rgba(170, 145, 220, 0.55) 0%, transparent 65%)',
          'radial-gradient(ellipse 60% 45% at 85% 75%, rgba(120, 180, 230, 0.55) 0%, transparent 65%)',
          'radial-gradient(ellipse 40% 35% at 90% 15%, rgba(255, 180, 200, 0.50) 0%, transparent 60%)',
          'radial-gradient(ellipse 45% 35% at 10% 85%, rgba(170, 205, 240, 0.50) 0%, transparent 60%)',
          'radial-gradient(ellipse 35% 25% at 55% 45%, rgba(200, 175, 230, 0.30) 0%, transparent 55%)',
          'radial-gradient(ellipse 30% 22% at 30% 65%, rgba(220, 205, 240, 0.32) 0%, transparent 55%)',
          'linear-gradient(135deg, #f5f7fc 0%, #ffffff 40%, #f3f4f9 100%)',
        ].join(', '),
      }}
    >
      {/* Slim obsidian banner — "internal portal" signal */}
      <div className="relative z-10 flex flex-shrink-0 items-center justify-center gap-3 bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white">
        <span className="text-gold-500">⚜</span>
        {t('officialBanner')}
        <span className="text-gold-500">⚜</span>
      </div>

      {/* Language toggle floats top-right (no full header bar) */}
      <div className="absolute right-6 top-9 z-20">
        <LanguageSwitcher variant="compact" />
      </div>

      {/* Centered card */}
      <section className="relative z-10 flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-[440px] border border-line bg-white px-9 py-10 text-center shadow-[0_1px_3px_rgba(0,0,0,0.04),_0_12px_32px_rgba(13,24,34,0.06)]">
          {/* IPA logo */}
          <div className="mb-6 flex justify-center">
            <Image
              src="/logo-ipa.png"
              alt="API Cameroun · Agence de Promotion des Investissements"
              width={1501}
              height={1136}
              priority
              className="h-[72px] w-auto"
            />
          </div>

          {/* "Portail interne" chip */}
          <div className="mb-4 inline-block border border-line px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-ink-3">
            {t('internalPortalBadge')}
          </div>

          {/* Headline */}
          <h1
            className="mb-3.5 text-[28px] font-semibold leading-[1.15] tracking-[-0.4px] text-ink"
            style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
          >
            {t('ctaLogin')}
          </h1>

          {/* Body */}
          <p className="mb-7 text-[14px] leading-[1.6] text-ink-3">
            {t('subtitle')}
          </p>

          {/* Primary CTA — Microsoft sky blue */}
          <Link
            href="/login"
            className="block w-full bg-[#0067b8] px-4 py-[13px] text-[14px] font-semibold text-white transition-colors hover:bg-[#005a9e] active:bg-[#004a85]"
          >
            🔐 {t('ctaLogin')}
          </Link>

          {/* Secondary link */}
          <Link
            href="/login"
            className="mt-4 inline-block text-[12px] text-ink-3 hover:text-ink hover:underline"
          >
            {locale === 'en' ? 'Need help?' : 'Besoin d\'aide ?'}
          </Link>
        </div>
      </section>

      {/* Tiny footer */}
      <footer className="relative z-10 flex-shrink-0 px-6 py-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-4">
        <span className="text-gold-500">⚜</span> {tCommon('appName')} ·{' '}
        {tCommon('republic')} · © MMXXVI
      </footer>
    </main>
  );
}
