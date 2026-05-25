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
  const t = await getTranslations('Home');
  const tCommon = await getTranslations('Common');

  return (
    <main>
      {/* ====== STAGE — editorial hero ====== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#f3f8f5] to-[#e8f1ec]">
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

        <header className="relative z-10 flex items-center justify-between border-b border-line bg-white/80 px-14 py-5 backdrop-blur">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian text-gold-500 font-display text-lg font-bold tracking-wide">
              A
              <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
                {tCommon('republic')}
              </div>
              <div className="serif text-[18px] font-bold text-ink">
                {tCommon('appNameLong')}
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-7 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            <LanguageSwitcher variant="editorial" />
          </nav>
        </header>

        <div className="relative z-10 grid grid-cols-[1.45fr_0.55fr]">
          <div className="border-r border-line px-14 py-24">
            <div className="mb-6 inline-flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-gold-700">
              {tCommon('officialPortal')}
              <span className="h-px w-11 bg-gold-600" />
            </div>
            <h1 className="serif mb-7 max-w-[640px] text-[clamp(44px,5vw,64px)] font-semibold leading-[1.06] tracking-[-0.022em] text-ink">
              {t('tagline')}
            </h1>
            <p className="mb-8 max-w-[560px] text-[16px] leading-[1.65] text-ink-2">
              {t('subtitle')}
            </p>
            <div className="serif inline-flex items-center gap-2.5 border-l-2 border-gold-600 pl-4 text-[14.5px] italic text-gold-700">
              « {t('quote')} »
            </div>
          </div>

          <aside className="flex flex-col bg-white px-12 py-24">
            <Stat num="7" label={locale === 'en' ? 'Workflow phases · Reception → Closure' : 'Phases du circuit · Réception → Clôture'} />
            <Stat num="37" label={locale === 'en' ? 'Org chart roles · Art. 1-46' : 'Rôles dans l\'organigramme · Art. 1-46'} />
            <Stat num="II" unit={locale === 'en' ? 'languages' : 'langues'} label="Français · English" last />
          </aside>
        </div>

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-14 py-5 text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
          <div className="flex flex-wrap items-center gap-5">
            <Seal icon="⚜">{tCommon('republic')}</Seal>
          </div>
          <div>© MMXXVI</div>
        </div>
      </section>

      {/* ====== Below the fold — two doors ====== */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-8">
          <div className="mb-12 text-center">
            <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-gold-700">
              {locale === 'en' ? 'Portal access' : 'Accès au portail'}
            </div>
            <h2 className="serif text-4xl font-semibold tracking-tight text-ink">
              {locale === 'en' ? 'What would you like to do?' : 'Que souhaitez-vous faire ?'}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <DoorCard
              href="/submit"
              eyebrow={locale === 'en' ? 'Any sender · no registration' : 'Tout émetteur · sans inscription'}
              title={t('submitDocument')}
              body={
                locale === 'en'
                  ? 'Send a dossier or letter to the IPA. You will receive an automatic acknowledgement and a tracking number to follow progress.'
                  : "Adressez un dossier ou un courrier à l'API. Vous recevrez un accusé de réception automatique et un numéro de suivi pour consulter l'avancement."
              }
              cta={`${t('submitDocument')} →`}
              disabled
              disabledNote={t('submitDocumentSoon')}
            />
            <DoorCard
              href="/login"
              eyebrow={t('staffLoginHint')}
              title={t('staffLogin')}
              body={
                locale === 'en'
                  ? 'Access your dashboard, inbox and active dossiers within your scope per the organisation chart.'
                  : 'Accédez à votre tableau de bord, à votre corbeille et aux dossiers en cours dans votre périmètre selon l\'organigramme.'
              }
              cta={`${t('staffLogin')} →`}
              accent
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-obsidian py-12 text-center text-[11px] uppercase tracking-[0.14em] text-white/55">
        <div className="font-bold text-gold-500">⚜ {tCommon('appName')} ⚜</div>
        <div className="mt-2">{tCommon('republic')}</div>
      </footer>
    </main>
  );
}

function Stat({ num, unit, label, last }: { num: string; unit?: string; label: string; last?: boolean }) {
  return (
    <div className={last ? 'py-6' : 'border-b border-line py-6'}>
      <div className="flex items-baseline gap-1.5">
        <span className="serif text-[52px] font-semibold leading-none tracking-[-0.02em] text-cmgreen-800">{num}</span>
        {unit ? <span className="text-[15px] font-medium italic text-ink-4">{unit}</span> : null}
      </div>
      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">{label}</div>
    </div>
  );
}

function Seal({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2">
      <span className="flex h-[18px] w-[18px] items-center justify-center border border-gold-600 text-[10px] text-gold-700">
        {icon}
      </span>
      {children}
    </span>
  );
}

function DoorCard({
  href, eyebrow, title, body, cta, accent, disabled, disabledNote,
}: {
  href: string; eyebrow: string; title: string; body: string; cta: string; accent?: boolean; disabled?: boolean; disabledNote?: string;
}) {
  const inner = (
    <>
      <div className={`mb-3 text-[10.5px] font-bold uppercase tracking-[0.26em] ${accent ? 'text-gold-500' : 'text-gold-700'}`}>
        {eyebrow}
      </div>
      <h3 className={`serif mb-3 text-[28px] font-semibold tracking-tight ${accent ? 'text-white' : 'text-ink'}`}>
        {title}
      </h3>
      <p className={`mb-6 text-[14px] leading-[1.65] ${accent ? 'text-white/75' : 'text-ink-2'}`}>{body}</p>
      <div className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] transition group-hover:gap-3 ${accent ? 'text-gold-500' : 'text-cmgreen-800'}`}>
        {cta}
      </div>
      {disabled && disabledNote && (
        <div className={`mt-3 text-[10.5px] uppercase tracking-[0.14em] ${accent ? 'text-white/55' : 'text-ink-4'}`}>
          {disabledNote}
        </div>
      )}
    </>
  );
  const cls = `group block border p-10 transition hover:shadow-lift ${accent ? 'border-obsidian bg-obsidian text-white' : 'border-line bg-white'} ${disabled ? 'pointer-events-none opacity-60' : ''}`;
  if (disabled) return <div className={cls}>{inner}</div>;
  return <Link href={href} className={cls}>{inner}</Link>;
}
