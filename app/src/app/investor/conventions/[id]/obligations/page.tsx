import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatFcfaCompact } from '@/lib/fcfa';
import { sectorLabel } from '@/lib/stages';
import { computeRoyalty, submissionStatusClass, SUBMISSION_STATUS_LABEL, type SubmissionStatus } from '@/lib/obligations-config';

export const metadata = { title: 'Obligations post-signature · Espace Investisseur' };
export const dynamic = 'force-dynamic';

const SUCCESS_MESSAGES: Record<string, string> = {
  'annual-report': 'Rapport annuel transmis.',
  'equipment-list': 'Liste d\'équipements transmise au Secrétariat et à la Douane.',
  royalty: 'Déclaration de redevance enregistrée.',
  extension: 'Demande d\'extension transmise pour examen.',
  attestation: 'Demande d\'attestation transmise.',
};

export default async function ObligationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');

  const { id } = await params;
  const { ok } = await searchParams;

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
    select: { id: true, raisonSociale: true },
  });
  if (!investor) redirect('/investor');

  const cv = await db.convention.findUnique({
    where: { id },
    include: {
      equipmentList: true,
      annualReports: { orderBy: { fiscalYear: 'desc' } },
      royaltyPayments: { orderBy: { fiscalYear: 'desc' } },
      extensionRequests: { orderBy: { submittedAt: 'desc' } },
      attestationRequest: true,
    },
  });
  if (!cv || cv.investorId !== investor.id) notFound();
  if (cv.status !== 'SIGNED' && cv.status !== 'CLOSED') {
    redirect(`/investor/conventions/${id}`);
  }

  const royaltyDue = computeRoyalty(cv.investmentFcfa);
  const currentYear = new Date().getFullYear();
  const fiscalPrevYear = currentYear - 1;

  // Status summaries for the hub
  const equipmentStatus    = cv.equipmentList?.status as SubmissionStatus | undefined;
  const latestAnnual       = cv.annualReports[0];
  const latestRoyalty      = cv.royaltyPayments[0];
  const latestExtension    = cv.extensionRequests[0];
  const attestationStatus  = cv.attestationRequest?.status as SubmissionStatus | undefined;

  const okMessage = ok && (() => {
    if (ok.startsWith('annual-report')) return SUCCESS_MESSAGES['annual-report'];
    if (ok.startsWith('royalty'))       return SUCCESS_MESSAGES.royalty;
    return SUCCESS_MESSAGES[ok];
  })();

  return (
    <section className="mx-auto max-w-6xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Convention {cv.reference}
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
        Obligations post-signature
      </h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        {cv.projectName} · {sectorLabel(cv.sector)} · Catégorie {cv.category} ·{' '}
        {formatFcfaCompact(cv.investmentFcfa)}
      </p>

      {okMessage && (
        <div className="mt-6 flex items-start gap-3 border-l-4 border-cmgreen-700 bg-cmgreen-50 px-4 py-3">
          <span className="text-[18px] leading-none text-cmgreen-800">✓</span>
          <div className="text-[13px] text-ink">
            <strong className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800">
              Transmission enregistrée
            </strong>
            {okMessage}
          </div>
        </div>
      )}

      <div className="mt-10 space-y-5">
        <ObligationCard
          article="Art. 33"
          title="Liste prévisionnelle d'équipements"
          cadence="Une seule fois · 10 jours ouvrés après signature"
          description="Liste détaillée des équipements et matériels prévus pour le projet, validée conjointement par l'API et la Douane (DGD)."
          href={`/investor/conventions/${cv.id}/equipment-list`}
          status={equipmentStatus}
          summary={
            cv.equipmentList
              ? `${(Array.isArray(cv.equipmentList.itemsJson) ? cv.equipmentList.itemsJson.length : 0)} lignes · total ${formatFcfaCompact(cv.equipmentList.totalValueFcfa)}`
              : 'Non transmise'
          }
        />

        <ObligationCard
          article="Art. 32"
          title="Rapport annuel d'exécution"
          cadence={`Tous les ans · échéance 31 mars ${currentYear + (new Date().getMonth() >= 3 ? 1 : 0)}`}
          penalty="1 M FCFA / mois de retard"
          description="Bilan annuel : emplois créés, investissement réalisé, exports, achats locaux. Adressé à l'API, au Comité d'audit, à la DGI et à la DGD."
          href={`/investor/conventions/${cv.id}/annual-report`}
          status={latestAnnual?.status as SubmissionStatus | undefined}
          summary={
            latestAnnual
              ? `Exercice ${latestAnnual.fiscalYear} · ${latestAnnual.jobsActual ?? '—'} emplois · ${formatFcfaCompact(latestAnnual.investmentActualFcfa ?? 0n)} réalisés${latestAnnual.isLate ? ` · retard ${latestAnnual.monthsLate} mois` : ''}`
              : `Pas encore transmis pour l'exercice ${fiscalPrevYear}`
          }
        />

        <ObligationCard
          article="Art. 48"
          title="Redevance annuelle"
          cadence="Tous les ans"
          description={`0,1 % du montant agréé (plancher 100 000 FCFA, plafond 5 M FCFA). Pour cette convention : ${formatFcfaCompact(royaltyDue)} par exercice.`}
          href={`/investor/conventions/${cv.id}/royalty`}
          status={latestRoyalty?.status as SubmissionStatus | undefined}
          summary={
            latestRoyalty
              ? `Exercice ${latestRoyalty.fiscalYear} · ${latestRoyalty.status === 'PAID' ? `payée ${latestRoyalty.amountPaidFcfa ? formatFcfaCompact(latestRoyalty.amountPaidFcfa) : ''}` : `due ${formatFcfaCompact(latestRoyalty.amountDueFcfa)}`}`
              : `Non déclarée pour l'exercice ${currentYear}`
          }
        />

        <ObligationCard
          article="Art. 36"
          title="Demande d'extension de délai"
          cadence="Si nécessaire · max 24 mois, non-renouvelable"
          description="Force majeure ou difficulté économique avérée. Avis obligatoire DGI + DGD au Guichet Unique."
          href={`/investor/conventions/${cv.id}/extension`}
          status={latestExtension?.status as SubmissionStatus | undefined}
          summary={
            latestExtension
              ? `Demande ${latestExtension.requestedMonths} mois · ${formatRelativeDate(latestExtension.submittedAt)}`
              : 'Aucune demande en cours'
          }
        />

        <ObligationCard
          article="Art. 34"
          title="Attestation de réalisation"
          cadence="À l'achèvement de la phase d'installation"
          description="Déclenche une visite conjointe API + DGI + DGD pour constater la réalisation du projet."
          href={`/investor/conventions/${cv.id}/attestation`}
          status={attestationStatus}
          summary={
            cv.attestationRequest
              ? `Date prévue : ${formatDate(cv.attestationRequest.expectedCompletionDate)}${cv.attestationRequest.inspectionScheduledAt ? ` · visite ${formatDate(cv.attestationRequest.inspectionScheduledAt)}` : ''}`
              : 'Non demandée'
          }
        />
      </div>

      <div className="mt-10 flex items-center gap-3">
        <Link
          href={`/investor/conventions/${cv.id}`}
          className="border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink"
        >
          ← Suivi du dossier
        </Link>
        <Link
          href="/investor"
          className="border border-line-2 bg-white px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink"
        >
          Mes dossiers
        </Link>
      </div>
    </section>
  );
}

function ObligationCard({
  article, title, cadence, description, href, status, summary, penalty,
}: {
  article: string;
  title: string;
  cadence: string;
  description: string;
  href: string;
  status?: SubmissionStatus;
  summary?: string;
  penalty?: string;
}) {
  return (
    <article className="grid gap-0 border border-line bg-white md:grid-cols-[1fr_220px]">
      <div className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-gold-700">
            {article}
          </span>
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-4">·</span>
          <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-3">{cadence}</span>
          {status && (
            <span className={`pill ${submissionStatusClass(status)} ml-auto md:ml-2`}>
              {SUBMISSION_STATUS_LABEL[status]}
            </span>
          )}
        </div>
        <h3 className="serif mt-2 text-[19px] font-bold leading-tight text-ink">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{description}</p>
        {penalty && (
          <p className="mt-2 text-[11.5px] italic text-cmred">⚠ {penalty}</p>
        )}
        {summary && (
          <p className="mt-3 border-t border-line pt-2 text-[12.5px] text-ink-3">
            <strong className="font-semibold text-ink-2">Dernière transmission&nbsp;:</strong> {summary}
          </p>
        )}
      </div>
      <Link
        href={href}
        className="flex items-center justify-center border-t border-line bg-bgsoft px-4 py-3 text-[11.5px] font-bold uppercase tracking-[0.14em] text-cmgreen-800 transition hover:bg-cmgreen-50 md:border-l md:border-t-0"
      >
        {status ? 'Mettre à jour →' : 'Transmettre →'}
      </Link>
    </article>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function formatRelativeDate(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'aujourd\'hui';
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} jours`;
  return formatDate(d);
}
