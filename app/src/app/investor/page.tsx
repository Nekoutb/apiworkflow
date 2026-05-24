import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatFcfaCompact } from '@/lib/fcfa';
import {
  STAGE_LABELS_FR,
  STAGE_ORDER,
  sectorLabel,
  stageIndex,
  stageLabel,
  statusLabel,
  statusPillClass,
} from '@/lib/stages';
import {
  buildObligations,
  daysBetween,
  formatDateFr,
  obligationStatusClass,
  OBLIGATION_STATUS_LABEL,
  type PostSignatureObligation,
} from '@/lib/post-signature-obligations';
import type { Convention, ConventionStage, ConventionStatus, Sector } from '@prisma/client';

export const metadata = { title: 'Mes dossiers · Espace Investisseur' };
export const dynamic = 'force-dynamic';

export default async function InvestorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');

  const { submitted } = await searchParams;

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
    include: {
      conventions: {
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          reference: true,
          projectName: true,
          sector: true,
          region: true,
          investmentFcfa: true,
          jobsPlanned: true,
          status: true,
          currentStage: true,
          submittedAt: true,
          signedAt: true,
          agreementNo: true,
          recepisseNo: true,
          category: true,
          createdAt: true,
        },
      },
    },
  });

  if (!investor) {
    return (
      <main className="mx-auto max-w-3xl px-7 py-16">
        <h1 className="serif text-3xl font-semibold text-ink">Profil investisseur introuvable</h1>
        <p className="serif mt-3 text-[14px] italic text-ink-3">
          Votre compte n&apos;est pas relié à un profil investisseur. Contactez l&apos;API ou créez un nouveau compte.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-block bg-cmgreen-800 px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.14em] text-white hover:bg-cmgreen-900"
        >
          Créer un compte investisseur →
        </Link>
      </main>
    );
  }

  const all = investor.conventions;
  const signed = all.filter((c) => c.status === 'SIGNED' || c.status === 'CLOSED');
  const inProgress = all.filter((c) => c.status !== 'SIGNED' && c.status !== 'CLOSED');

  return (
    <section className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Mon espace
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
        Bonjour, {session.user.name ?? investor.raisonSociale}
      </h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        {investor.raisonSociale} · {investor.legalForm ?? 'forme juridique non renseignée'} ·{' '}
        {investor.city ?? '—'}{investor.region ? ` (${investor.region})` : ''}
      </p>

      {submitted && (
        <div className="mt-6 flex items-start gap-3 border-l-4 border-cmgreen-700 bg-cmgreen-50 px-4 py-3">
          <span className="text-[18px] leading-none text-cmgreen-800">✓</span>
          <div className="text-[13px] leading-relaxed text-ink">
            <strong className="block text-[11px] font-bold uppercase tracking-[0.14em] text-cmgreen-800">
              Dossier soumis
            </strong>
            Votre dossier <strong className="font-mono">{submitted}</strong> a été transmis au
            Secrétariat. Un email de confirmation vous a été envoyé. L&apos;instruction démarre
            sous 10 jours ouvrés.
          </div>
        </div>
      )}

      {all.length === 0 && <EmptyState isExisting={investor.isExisting} />}

      {signed.length > 0 && (
        <div className="mt-12">
          <SectionHeader
            kicker="⚜ Convention signée"
            title="Mon agrément en cours"
            sub={
              signed.length > 1
                ? `${signed.length} conventions signées par le Directeur Général.`
                : 'Convention signée par le Directeur Général.'
            }
          />
          <div className="mt-6 space-y-8">
            {signed.map((cv) => (
              <SignedConventionCard key={cv.id} cv={cv} />
            ))}
          </div>
        </div>
      )}

      {inProgress.length > 0 && (
        <div className="mt-14">
          <SectionHeader
            kicker="Instruction en cours"
            title={signed.length > 0 ? 'Autres dossiers' : 'Mes dossiers'}
            sub={`${inProgress.length} dossier${inProgress.length > 1 ? 's' : ''} en cours d'instruction.`}
            cta={
              <Link
                href="/investor/new"
                className="border border-cmgreen-700 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 transition hover:bg-cmgreen-50"
              >
                + Nouveau dossier
              </Link>
            }
          />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {inProgress.map((cv) => (
              <ConventionInProgressCard key={cv.id} cv={cv} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ============ Sub-components ============

function SectionHeader({
  kicker, title, sub, cta,
}: { kicker: string; title: string; sub?: string; cta?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-line pb-3">
      <div>
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-gold-700">
          {kicker}
        </div>
        <h2 className="serif mt-1 text-[24px] font-semibold tracking-[-0.3px] text-ink">{title}</h2>
        {sub && <p className="serif mt-1 text-[13px] italic text-ink-3">{sub}</p>}
      </div>
      {cta}
    </div>
  );
}

function EmptyState({ isExisting }: { isExisting: boolean }) {
  return (
    <div className="mt-12 border border-dashed border-line-2 bg-white p-10 text-center">
      <div className="serif text-[19px] font-bold text-ink">
        {isExisting
          ? 'Votre convention existante sera bientôt importée'
          : 'Vous n\'avez pas encore de dossier'}
      </div>
      <p className="serif mt-2 text-[13.5px] italic text-ink-3">
        {isExisting
          ? 'Les conventions signées avant le lancement du portail sont en cours d\'import par l\'équipe API.'
          : 'Commencez par téléverser les pièces obligatoires pour soumettre votre demande d\'agrément.'}
      </p>
      {!isExisting && (
        <Link
          href="/investor/new"
          className="mt-6 inline-block bg-cmgreen-800 px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900"
        >
          Démarrer un nouveau dossier →
        </Link>
      )}
    </div>
  );
}

type ConventionRow = Pick<
  Convention,
  | 'id' | 'reference' | 'projectName' | 'sector' | 'region'
  | 'investmentFcfa' | 'jobsPlanned' | 'status' | 'currentStage'
  | 'submittedAt' | 'signedAt' | 'agreementNo' | 'recepisseNo' | 'category' | 'createdAt'
>;

function ConventionInProgressCard({ cv }: { cv: ConventionRow }) {
  const isDraft = cv.status === 'DRAFT' || cv.status === 'RETURNED';
  const href = isDraft ? `/investor/conventions/${cv.id}/edit` : `/investor/conventions/${cv.id}`;

  return (
    <article className="group border border-line bg-white transition hover:border-cmgreen-700 hover:shadow-lift">
      {/* Header band */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-bgsoft px-5 py-3">
        <span className="inline-block border border-line-2 bg-white px-2 py-0.5 font-sans text-[11px] font-bold tracking-[0.06em] text-ink-2">
          {cv.reference}
        </span>
        <span className={`pill ${statusPillClass(cv.status)}`}>{statusLabel(cv.status)}</span>
      </div>

      {/* Title + tags */}
      <div className="px-5 pt-5">
        <h3 className="serif text-[19px] font-bold leading-tight text-ink">{cv.projectName}</h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
          <Tag>{sectorLabel(cv.sector)}</Tag>
          <Tag>Catégorie {cv.category}</Tag>
          {cv.region && <Tag>{cv.region}</Tag>}
        </div>
      </div>

      {/* Stats */}
      <dl className="mx-5 mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
        <Stat label="Investissement" value={formatFcfaCompact(cv.investmentFcfa)} />
        <Stat label="Emplois prévus" value={cv.jobsPlanned.toLocaleString('fr-FR')} />
      </dl>

      {/* Stage progress — labels go BELOW so they never overlap the dots */}
      <div className="mx-5 mt-5 border-t border-line pt-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-3">
          {isDraft ? 'Statut' : 'Étape actuelle'}
        </div>
        <div className="serif mt-1 text-[15px] font-semibold text-ink">
          {isDraft ? statusLabel(cv.status) : stageLabel(cv.currentStage)}
          {!isDraft && (
            <span className="ml-2 font-sans text-[11px] font-normal uppercase tracking-[0.12em] text-ink-4">
              ({stageIndex(cv.currentStage) + 1} / 5)
            </span>
          )}
        </div>
        <ProgressBar current={cv.currentStage} status={cv.status} />
      </div>

      {/* CTA */}
      <Link
        href={href}
        className="flex items-center justify-between border-t border-line bg-white px-5 py-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 transition group-hover:bg-cmgreen-50"
      >
        {isDraft ? 'Continuer le dossier' : 'Voir le suivi'}
        <span aria-hidden>→</span>
      </Link>
    </article>
  );
}

function SignedConventionCard({ cv }: { cv: ConventionRow }) {
  const obligations = cv.signedAt
    ? buildObligations(cv.id, { signedAt: cv.signedAt })
    : [];

  return (
    <article className="grid gap-6 border border-cmgreen-700 bg-white lg:grid-cols-[1.1fr_1fr]">
      {/* LEFT — Certificate */}
      <div className="relative border-b border-cmgreen-700 p-7 lg:border-b-0 lg:border-r">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(rgba(193, 151, 63, 0.08) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
            ⚜ Convention d&apos;investissement
          </div>
          <h3 className="serif mt-2 text-[24px] font-bold leading-tight tracking-[-0.3px] text-ink">
            {cv.projectName}
          </h3>
          <p className="serif mt-2 text-[13px] italic text-ink-3">
            {sectorLabel(cv.sector)} · Catégorie {cv.category}
            {cv.region && ` · ${cv.region}`}
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5">
            <CertItem label="N° d'agrément" value={cv.agreementNo ?? cv.reference} mono />
            <CertItem label="Signée le" value={cv.signedAt ? formatDateFr(cv.signedAt) : '—'} />
            <CertItem label="Montant agréé" value={formatFcfaCompact(cv.investmentFcfa)} />
            <CertItem label="Emplois prévus" value={cv.jobsPlanned.toLocaleString('fr-FR')} />
          </dl>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled
              className="bg-cmgreen-800 px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-white opacity-50"
              title="Disponible en A7"
            >
              📄 Télécharger la convention
            </button>
            <button
              type="button"
              disabled
              className="border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 opacity-50"
              title="Disponible en A7"
            >
              Acte d&apos;agrément
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT — Post-signature obligations */}
      <div className="p-7">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
          Obligations post-signature
        </div>
        <h4 className="serif mt-1 text-[18px] font-bold text-ink">
          Ce que vous devez transmettre
        </h4>
        <p className="serif mt-1 text-[12px] italic text-ink-3">
          Conformément à l&apos;Ordonnance n° 2025/002 du 18 juillet 2025.
        </p>

        <ul className="mt-5 space-y-3.5">
          {obligations.map((o) => (
            <ObligationRow key={o.key} o={o} />
          ))}
        </ul>

        <div className="mt-5 border-t border-line pt-3 text-[11px] italic text-ink-4">
          Les formulaires de transmission seront activés à l&apos;étape A7. Les échéances ci-dessus
          se mettent à jour automatiquement.
        </div>
      </div>
    </article>
  );
}

function ObligationRow({ o }: { o: PostSignatureObligation }) {
  const daysLeft = o.deadlineLabel ? daysFromDeadlineLabel(o.deadlineLabel) : null;
  return (
    <li className="border-l-2 border-line-2 pl-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-700">
            {o.article} · {cadenceLabel(o.cadence)}
          </div>
          <div className="serif mt-0.5 text-[14px] font-semibold leading-snug text-ink">
            {o.title}
          </div>
          <div className="mt-1 text-[12px] leading-snug text-ink-2">{o.description}</div>
          {o.penalty && (
            <div className="mt-1 text-[11px] italic text-cmred">
              ⚠ Pénalité&nbsp;: {o.penalty}
            </div>
          )}
        </div>
        {o.status && (
          <span className={`pill ${obligationStatusClass(o.status)} flex-none`}>
            {OBLIGATION_STATUS_LABEL[o.status]}
          </span>
        )}
      </div>
      {o.deadlineLabel && (
        <div className="mt-1.5 text-[11.5px] text-ink-3">
          Échéance&nbsp;: <strong className="font-semibold text-ink-2">{o.deadlineLabel}</strong>
          {daysLeft !== null && daysLeft >= 0 && (
            <span className="ml-1.5 text-ink-4">(dans {daysLeft} j)</span>
          )}
          {daysLeft !== null && daysLeft < 0 && (
            <span className="ml-1.5 text-cmred">(en retard de {Math.abs(daysLeft)} j)</span>
          )}
        </div>
      )}
    </li>
  );
}

function CertItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</dt>
      <dd className={`serif mt-0.5 text-[15px] font-semibold text-ink ${mono ? 'font-mono text-[14px] tracking-tight' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</dt>
      <dd className="serif mt-1 text-[20px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block border border-line-2 bg-white px-1.5 py-0.5 text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
      {children}
    </span>
  );
}

function ProgressBar({ current, status }: { current: ConventionStage; status: ConventionStatus }) {
  const idx = stageIndex(current);
  const isSigned = status === 'SIGNED' || status === 'CLOSED';
  return (
    <div className="mt-3 flex items-center gap-1.5">
      {STAGE_ORDER.map((s, i) => {
        const reached = isSigned ? true : i < idx;
        const here = i === idx && !isSigned;
        return (
          <div
            key={s}
            title={STAGE_LABELS_FR[s]}
            aria-label={STAGE_LABELS_FR[s]}
            className={
              'h-2 flex-1 ' +
              (here
                ? 'bg-cmgreen-800'
                : reached
                  ? 'bg-cmgreen-700'
                  : 'bg-line-2')
            }
          />
        );
      })}
    </div>
  );
}

function cadenceLabel(c: PostSignatureObligation['cadence']): string {
  switch (c) {
    case 'ONE_TIME':      return 'Une seule fois';
    case 'ANNUAL':        return 'Tous les ans';
    case 'ON_DEMAND':     return 'Si nécessaire';
    case 'ON_COMPLETION': return 'À l\'achèvement';
  }
}

/** Re-parse the FR-formatted date back to a Date so we can show "in X days". */
function daysFromDeadlineLabel(label: string): number | null {
  // Cheap: rely on Date.parse with FR month names → no.  Use intl.
  // Instead, recompute relative to today using the explicit ISO mapping below.
  const months: Record<string, number> = {
    janvier: 0, février: 1, mars: 2, avril: 3, mai: 4, juin: 5,
    juillet: 6, août: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11,
  };
  const m = /^(\d{1,2})\s+([a-zûéê]+)\s+(\d{4})$/i.exec(label);
  if (!m) return null;
  const day = Number(m[1]);
  const month = months[m[2].toLowerCase()];
  const year = Number(m[3]);
  if (month === undefined || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  const target = new Date(Date.UTC(year, month, day));
  return daysBetween(new Date(), target);
}
