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

export const metadata = { title: 'Mes dossiers · Espace Investisseur' };
export const dynamic = 'force-dynamic';

export default async function InvestorHomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
    include: {
      conventions: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          projectName: true,
          sector: true,
          investmentFcfa: true,
          jobsPlanned: true,
          status: true,
          currentStage: true,
          submittedAt: true,
          signedAt: true,
          category: true,
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

  const conventions = investor.conventions;
  const hasAny = conventions.length > 0;

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
        {investor.city ?? '—'} ({investor.region ?? '—'})
      </p>

      {!hasAny ? (
        <EmptyState isExisting={investor.isExisting} />
      ) : (
        <>
          <div className="mt-10 flex items-center justify-between">
            <h2 className="serif text-[22px] font-semibold text-ink">Mes dossiers</h2>
            <Link
              href="/investor/new"
              className="border border-cmgreen-700 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 transition hover:bg-cmgreen-50"
            >
              + Nouveau dossier
            </Link>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {conventions.map((cv) => (
              <article key={cv.id} className="border border-line bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[11.5px] font-semibold text-ink-3">{cv.reference}</div>
                    <h3 className="serif mt-1 text-[19px] font-bold leading-tight text-ink">
                      {cv.projectName}
                    </h3>
                    <div className="mt-1 text-[12.5px] italic text-ink-3">
                      {sectorLabel(cv.sector)} · Catégorie {cv.category}
                    </div>
                  </div>
                  <span className={`pill ${statusPillClass(cv.status)}`}>{statusLabel(cv.status)}</span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                      Investissement
                    </div>
                    <div className="serif mt-1 text-[20px] font-semibold text-ink">
                      {formatFcfaCompact(cv.investmentFcfa)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                      Emplois prévus
                    </div>
                    <div className="serif mt-1 text-[20px] font-semibold text-ink">
                      {cv.jobsPlanned.toLocaleString('fr-FR')}
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-line pt-4">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-3">
                    Étape actuelle · {cv.status === 'SIGNED' ? '✓ Signée' : stageLabel(cv.currentStage)}
                  </div>
                  <StageStrip current={cv.currentStage} status={cv.status} />
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function EmptyState({ isExisting }: { isExisting: boolean }) {
  return (
    <div className="mt-10 border border-dashed border-line-2 bg-white p-10 text-center">
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

function StageStrip({ current, status }: { current: string; status: string }) {
  const idx = stageIndex(current as never);
  const isSigned = status === 'SIGNED' || status === 'CLOSED';
  return (
    <ol className="flex items-center gap-1">
      {STAGE_ORDER.map((s, i) => {
        const reached = isSigned ? true : i < idx;
        const here = i === idx && !isSigned;
        return (
          <li key={s} className="flex flex-1 items-center gap-1.5" title={STAGE_LABELS_FR[s]}>
            <span
              className={
                'flex h-6 w-6 items-center justify-center text-[10px] font-bold tabular ' +
                (here
                  ? 'border border-cmgreen-800 bg-cmgreen-50 text-cmgreen-800'
                  : reached
                    ? 'bg-cmgreen-800 text-white'
                    : 'border border-line-2 bg-white text-ink-4')
              }
            >
              {i + 1}
            </span>
            <span className={'flex-1 truncate text-[10.5px] uppercase tracking-[0.12em] ' + (here ? 'font-bold text-ink' : 'text-ink-4')}>
              {STAGE_LABELS_FR[s].replace('Dir. ', '')}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
