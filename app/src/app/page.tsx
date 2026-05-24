import Link from 'next/link';

export default function LandingPage() {
  return (
    <main>
      {/* ====== STAGE — editorial hero ====== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#f3f8f5] to-[#e8f1ec]">
        {/* subtle textures */}
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

        {/* Top marquee */}
        <header className="relative z-10 flex items-center justify-between border-b border-line bg-white/80 px-14 py-5 backdrop-blur">
          <div className="flex items-center gap-3.5">
            <div className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian text-gold-500 font-display text-lg font-bold tracking-wide">
              A
              <span
                aria-hidden
                className="pointer-events-none absolute inset-[3px] border border-gold-500/45"
              />
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
                République du Cameroun · Présidence de la République
              </div>
              <div className="serif text-[18px] font-bold text-ink">
                Agence de Promotion des Investissements
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-7 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
            <a className="hover:text-cmgreen-800" href="#">Cadre légal</a>
            <a className="hover:text-cmgreen-800" href="#">Secteurs prioritaires</a>
            <a className="hover:text-cmgreen-800" href="#">Incitations</a>
            <a className="hover:text-cmgreen-800" href="#">Contact</a>
            <div className="inline-flex border border-line-2">
              <button className="bg-obsidian px-2.5 py-1 text-[10.5px] font-bold tracking-wide text-gold-500">FR</button>
              <button className="border-l border-line-2 bg-white px-2.5 py-1 text-[10.5px] tracking-wide text-ink-3">EN</button>
            </div>
          </nav>
        </header>

        {/* Hero body */}
        <div className="relative z-10 grid grid-cols-[1.45fr_0.55fr]">
          <div className="border-r border-line px-14 py-24">
            <div className="mb-6 inline-flex items-center gap-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-gold-700">
              Portail officiel · Ordonnance n° 2025/002
              <span className="h-px w-11 bg-gold-600" />
            </div>
            <h1 className="serif mb-7 max-w-[640px] text-[clamp(44px,5vw,64px)] font-semibold leading-[1.06] tracking-[-0.022em] text-ink">
              L&apos;investissement<br />au Cameroun,
              <br />
              <span className="text-cmgreen-800 italic">une affaire de souveraineté.</span>
            </h1>
            <p className="mb-8 max-w-[560px] text-[16px] leading-[1.65] text-ink-2">
              Plateforme officielle de soumission, d&apos;instruction et de suivi des conventions
              d&apos;investissement entre l&apos;État du Cameroun et les investisseurs nationaux et
              internationaux. Filer un dossier en ligne, suivre son parcours à toutes les étapes,
              recevoir votre acte d&apos;agrément sans déplacement.
            </p>
            <div className="serif inline-flex items-center gap-2.5 border-l-2 border-gold-600 pl-4 text-[14.5px] italic text-gold-700">
              « Promouvoir l&apos;investissement productif, accélérer la croissance partagée. »
            </div>
          </div>

          <aside className="flex flex-col bg-white px-12 py-24">
            <Stat num="10" unit="j ouvrés" label="Délai légal après récépissé · Art. 30.3" />
            <Stat num="5" label="Étapes de validation · Secrétariat → DG" />
            <Stat num="8" label="Secteurs prioritaires éligibles · Art. 3" />
            <Stat num="II" unit="langues" label="Français · English" last />
          </aside>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-14 py-5 text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
          <div className="flex flex-wrap items-center gap-5">
            <Seal icon="⚜">République du Cameroun</Seal>
            <Seal icon="§">Loi 2010/012 protégée</Seal>
            <Seal icon="▲">TLS 1.3 chiffrement</Seal>
          </div>
          <div>© MMXXVI — Tous droits réservés</div>
        </div>
      </section>

      {/* ====== Below-the-fold: two doors (Investor / Personnel) ====== */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-8">
          <div className="mb-12 text-center">
            <div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.26em] text-gold-700">
              Accès au portail
            </div>
            <h2 className="serif text-4xl font-semibold tracking-tight text-ink">
              Identifiez-vous selon votre profil
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <DoorCard
              href="/login?type=investor"
              eyebrow="Pour les entreprises"
              title="Espace Investisseur"
              body="Déposer votre dossier de demande d'agrément, téléverser les pièces obligatoires, suivre l'avancement de votre dossier et récupérer votre convention signée."
              cta="Espace Investisseur →"
            />
            <DoorCard
              href="/login?type=staff"
              eyebrow="Pour le personnel API"
              title="Portail Interne"
              body="Workflow d'instruction des conventions, examen des pièces, assistance IA pour la conformité, signature finale du Directeur Général et pilotage de la performance."
              cta="Portail Interne →"
              accent
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-obsidian py-12 text-center text-[11px] uppercase tracking-[0.14em] text-white/55">
        <div className="font-bold text-gold-500">⚜ API Cameroun ⚜</div>
        <div className="mt-2">République du Cameroun · Présidence de la République</div>
        <div className="mt-1 normal-case tracking-normal text-white/40">
          Connexion chiffrée TLS 1.3 · Loi 2010/012 sur la protection des données personnelles
        </div>
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
  href, eyebrow, title, body, cta, accent,
}: {
  href: string; eyebrow: string; title: string; body: string; cta: string; accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block border p-10 transition hover:shadow-lift ${
        accent ? 'border-obsidian bg-obsidian text-white' : 'border-line bg-white'
      }`}
    >
      <div className={`mb-3 text-[10.5px] font-bold uppercase tracking-[0.26em] ${accent ? 'text-gold-500' : 'text-gold-700'}`}>
        {eyebrow}
      </div>
      <h3 className={`serif mb-3 text-[28px] font-semibold tracking-tight ${accent ? 'text-white' : 'text-ink'}`}>
        {title}
      </h3>
      <p className={`mb-6 text-[14px] leading-[1.65] ${accent ? 'text-white/75' : 'text-ink-2'}`}>{body}</p>
      <div
        className={`inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] transition group-hover:gap-3 ${
          accent ? 'text-gold-500' : 'text-cmgreen-800'
        }`}
      >
        {cta}
      </div>
    </Link>
  );
}
