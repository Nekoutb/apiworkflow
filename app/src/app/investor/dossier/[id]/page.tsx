import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, AlertCircle, Clock, FileText } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Logo } from '@/components/brand/Logo';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { MANDATORY_DOCS, STATE_LABEL_FR, progressForDocuments } from '@/lib/dossier';
import { UploadDocForm } from './UploadDocForm';
import { SubmitDossierButton } from './SubmitDossierButton';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export default async function DossierDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');

  const dossier = await db.dossier.findUnique({
    where: { id },
    include: {
      investorProfile: { include: { user: true } },
      documents: true,
      history: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  });
  if (!dossier) notFound();
  if (dossier.investorProfile.userId !== session.user.id) redirect('/investor');

  const progress = progressForDocuments(dossier.documents);
  const isDraft = dossier.state === 'DRAFT';
  const isSubmittedOrLater = dossier.state !== 'DRAFT';

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-cmgreen-700 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Logo className="h-10 w-10 rounded-lg" />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wider opacity-80">Espace Investisseur</div>
            <div className="text-sm font-semibold">API Cameroun</div>
          </div>
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-cmgreen-700 via-cmred to-cmyellow" />
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link href="/investor" className="mb-4 inline-flex items-center gap-1.5 text-sm text-cmgreen-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Tableau de bord
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Dossier {dossier.reference}</h1>
            <p className="mt-1 text-sm text-ink-muted">{dossier.investorProfile.raisonSociale}</p>
          </div>
          <StatusBadge state={dossier.state} />
        </div>

        {/* Status banner */}
        <div className={`mt-5 rounded-xl border-l-4 p-5 ${stateBannerClasses(dossier.state)}`}>
          <h2 className="font-semibold">{STATE_LABEL_FR[dossier.state]}</h2>
          <p className="mt-1 text-sm">{stateBannerCopy(dossier.state, progress)}</p>
        </div>

        {/* Overview */}
        <section className="card mt-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Synthèse</h3>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Meta label="Secteur" value={sectorLabel(dossier.sector)} />
            <Meta label="Type" value={dossier.projectType === 'NEW' ? 'Projet nouveau (Art. 7)' : "Projet d'extension (Art. 8)"} />
            <Meta label="Catégorie" value={`${dossier.category} — ${categoryBand(dossier.category)}`} />
            <Meta label="Montant" value={`${formatFcfa(dossier.amountFcfa)} FCFA`} />
            <Meta label="Durée installation" value={`${dossier.installationMonths} mois`} />
            <Meta label="ZDP" value={dossier.isZdp ? (dossier.zdpLocality || 'Oui') : 'Non'} />
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-ink">{dossier.objet}</p>
        </section>

        {/* Documents */}
        <section className="card mt-6">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Pièces justificatives obligatoires (Art. 6)
            </h3>
            <span className="text-sm font-semibold text-ink">
              {progress.uploadedDocs} / {progress.totalDocs} téléversées
            </span>
          </div>

          <div className="space-y-3">
            {MANDATORY_DOCS.map((m) => {
              const existing = dossier.documents.find((d) => d.kind === m.kind);
              return (
                <DocRow key={m.kind} label={m.label} article={m.article} existing={existing} dossierId={dossier.id} isDraft={isDraft} isSubmitted={isSubmittedOrLater} />
              );
            })}
          </div>

          {isDraft && progress.allUploaded && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-success-bg p-4 text-sm text-success">
              <span>✓ Les 6 pièces sont prêtes. Vous pouvez soumettre votre demande au Guichet Unique.</span>
              <SubmitDossierButton dossierId={dossier.id} />
            </div>
          )}
          {isDraft && !progress.allUploaded && (
            <div className="mt-5 rounded-lg bg-warning-bg p-4 text-xs text-warning">
              Téléversez les 6 pièces ci-dessus pour pouvoir soumettre votre demande.
            </div>
          )}
        </section>

        {/* History */}
        {dossier.history.length > 0 && (
          <section className="card mt-6">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-muted">Historique</h3>
            <ul className="space-y-3">
              {dossier.history.map((h) => (
                <li key={h.id} className="flex gap-3 text-sm">
                  <span className="mt-1 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-cmgreen-500" />
                  <div>
                    <div className="text-ink-muted text-xs">{new Date(h.createdAt).toLocaleString('fr-FR')}</div>
                    <div>{h.action}</div>
                    {h.comment ? <div className="mt-1 italic text-ink-muted">« {h.comment} »</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

// ---------- inline components ----------

function DocRow({
  label, article, existing, dossierId, isDraft, isSubmitted,
}: {
  label: string; article: string;
  existing: { kind: string; fileName: string; verification: string; rejectionReason: string | null; verifiedAt: Date | null } | undefined;
  dossierId: string;
  isDraft: boolean;
  isSubmitted: boolean;
}) {
  const status: 'EMPTY' | 'PENDING' | 'ACCEPTED' | 'REJECTED' = !existing
    ? 'EMPTY'
    : (existing.verification as 'PENDING' | 'ACCEPTED' | 'REJECTED');

  const styles = {
    EMPTY:    { dot: 'bg-ink-faint',  bg: 'bg-bg-page',     label: 'Non téléversée', tone: 'text-ink-muted' },
    PENDING:  { dot: 'bg-warning',    bg: 'bg-warning-bg',  label: 'Téléversée — en attente de vérification', tone: 'text-warning' },
    ACCEPTED: { dot: 'bg-success',    bg: 'bg-success-bg',  label: 'Acceptée par le Guichet Unique', tone: 'text-success' },
    REJECTED: { dot: 'bg-danger',     bg: 'bg-danger-bg',   label: 'Rejetée — à re-téléverser', tone: 'text-danger' },
  }[status];

  return (
    <div className={`rounded-lg border border-border ${styles.bg} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${styles.dot}`} />
          <div>
            <div className="text-sm font-semibold">
              {label} <span className="ml-1 text-xs font-normal text-ink-faint">· {article}</span>
            </div>
            <div className={`mt-0.5 text-xs ${styles.tone}`}>{styles.label}</div>
            {existing?.fileName && <div className="mt-1 text-xs text-ink-muted">📄 {existing.fileName}</div>}
            {existing?.rejectionReason && (
              <div className="mt-1 text-xs italic text-danger">« {existing.rejectionReason} »</div>
            )}
          </div>
        </div>
        {(isDraft || (isSubmitted && status === 'REJECTED')) && (
          <UploadDocForm dossierId={dossierId} kind={existing?.kind ?? (kindFromLabel(label) as string)} replace={!!existing} />
        )}
      </div>
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  const cls =
    state === 'DRAFT'      ? 'bg-bg-page text-ink-muted border-border' :
    state === 'SUBMITTED'  ? 'bg-info-bg text-info border-info' :
    state === 'ACCREDITED' ? 'bg-success-bg text-success border-success' :
    state === 'REJECTED'   ? 'bg-danger-bg text-danger border-danger' :
                              'bg-warning-bg text-warning border-warning';
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>{state}</span>;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink">{value}</dd>
    </div>
  );
}

// ---------- helpers ----------

function sectorLabel(s: string): string {
  const m: Record<string, string> = {
    AGRICULTURE: 'Agriculture, élevage et pêche',
    INDUSTRIE: 'Industrie lourde, automobile, manufacturière',
    ENERGIE: 'Eau et énergie',
    EDUCATION: 'Éducation et santé',
    TRANSPORT: 'Transport aérien, ferroviaire, maritime',
    TOURISME: 'Tourisme et loisirs',
    DISTRIBUTION: 'Infrastructures de grande distribution',
    NUMERIQUE: 'Infrastructures stockage / traitement de données',
  };
  return m[s] ?? s;
}

function categoryBand(c: string): string {
  return { A: '< 1 Md FCFA', B: '1–5 Md FCFA', C: '> 5 Md FCFA' }[c] ?? '';
}

function formatFcfa(amount: bigint): string {
  return amount.toLocaleString('fr-FR');
}

function stateBannerClasses(state: string): string {
  if (state === 'DRAFT')      return 'border-l-ink-faint bg-bg-page text-ink';
  if (state === 'SUBMITTED')  return 'border-l-info bg-info-bg text-info';
  if (state === 'ACCREDITED') return 'border-l-success bg-success-bg text-success';
  if (state === 'REJECTED')   return 'border-l-danger bg-danger-bg text-danger';
  return 'border-l-warning bg-warning-bg text-warning';
}

function stateBannerCopy(state: string, p: { uploadedDocs: number; totalDocs: number; anyRejected: boolean }): string {
  if (state === 'DRAFT') {
    return `Téléversez les ${p.totalDocs} pièces obligatoires, puis soumettez votre demande au Guichet Unique. ${p.uploadedDocs}/${p.totalDocs} téléversée(s).`;
  }
  if (state === 'SUBMITTED') {
    if (p.anyRejected) {
      return 'Certaines pièces ont été rejetées. Consultez la liste ci-dessous et re-téléversez les pièces concernées.';
    }
    return 'Votre dossier est soumis. Le Guichet Unique vérifie actuellement chaque pièce. Vous serez notifié(e) dès la délivrance du récépissé.';
  }
  if (state === 'ACCREDITED') {
    return "Félicitations. La convention d'investissement a été signée. L'acte d'agrément est disponible.";
  }
  if (state === 'REJECTED') {
    return 'Votre demande a été rejetée. Consultez les messages pour les motifs détaillés.';
  }
  return "Votre dossier est en cours d'instruction au sein du Guichet Unique. Délai légal : 10 jours ouvrés (Art. 30.3).";
}

function kindFromLabel(label: string): string {
  // Map label back to DocumentKind enum — used when no document yet exists
  if (label.startsWith('Autor'))     return 'ACTIVITY_AUTHORIZATION';
  if (label.startsWith('Plan de r')) return 'RECRUITMENT_PLAN';
  if (label.startsWith('Plan de t')) return 'TECH_TRANSFER_PLAN';
  if (label.startsWith('Plan de s')) return 'LOCAL_SUBCONTRACTING';
  if (label.startsWith('Justific'))  return 'FINANCING_PROOF';
  if (label.startsWith('Étude'))     return 'FEASIBILITY';
  return 'OTHER';
}
