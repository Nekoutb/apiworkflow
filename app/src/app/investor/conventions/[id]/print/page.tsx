import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatFcfa } from '@/lib/fcfa';
import { sectorLabel, stageLabel } from '@/lib/stages';
import { PrintButton } from './PrintButton';

export const metadata = { title: 'Convention · à imprimer' };
export const dynamic = 'force-dynamic';

/**
 * Print-friendly convention page.
 *
 * Until the proper PDF is generated at DG signature in A14, this page
 * serves as the downloadable "convention" — investor opens it, hits
 * Cmd/Ctrl-P and saves as PDF.  Layout uses A4 proportions and avoids
 * the gov-header chrome.
 */
export default async function PrintConventionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');
  const { id } = await params;

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id }, select: { id: true },
  });
  if (!investor) redirect('/investor');

  const cv = await db.convention.findUnique({
    where: { id },
    include: {
      investor: true,
      signer: { select: { name: true, email: true } },
    },
  });
  if (!cv || cv.investorId !== investor.id) notFound();

  const isSigned = cv.status === 'SIGNED' || cv.status === 'CLOSED';

  return (
    <main className="mx-auto max-w-[210mm] bg-white px-12 py-16 print:max-w-none print:px-0 print:py-0">
      {/* Print controls (hidden on print) */}
      <div className="mb-8 flex items-center justify-between border-b border-line pb-4 print:hidden">
        <a href={`/investor/conventions/${cv.id}`} className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink">
          ← Retour au suivi
        </a>
        <PrintButton />
      </div>

      {/* === Document body === */}
      <article className="border-4 border-double border-cmgreen-800 p-10 print:border-0">
        <header className="text-center">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.28em] text-gold-700">
            République du Cameroun · Présidence de la République
          </div>
          <div className="serif mt-2 text-[15px] font-bold uppercase tracking-[0.18em] text-ink">
            Agence de Promotion des Investissements
          </div>
          <div className="mt-8 inline-flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-gold-700">
            <span className="h-px w-12 bg-gold-600" />
            Convention d&apos;investissement
            <span className="h-px w-12 bg-gold-600" />
          </div>
          <h1 className="serif mt-3 text-[34px] font-semibold leading-tight tracking-[-0.3px] text-cmgreen-800">
            N° {cv.agreementNo ?? cv.reference}
          </h1>
          {!isSigned && (
            <div className="mt-3 inline-block border border-cmred bg-cmred-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cmred">
              ⚠ Brouillon · convention non signée par le DG
            </div>
          )}
        </header>

        <section className="mt-10 grid grid-cols-2 gap-x-10 gap-y-5 border-t border-line pt-7">
          <Cell label="Investisseur" value={cv.investor.raisonSociale} />
          <Cell label="Forme juridique" value={cv.investor.legalForm ?? '—'} />
          <Cell label="NIU" value={cv.investor.niu ?? '—'} mono />
          <Cell label="Adresse" value={[cv.investor.city, cv.investor.region].filter(Boolean).join(', ') || '—'} />
        </section>

        <section className="mt-7 border-t border-line pt-7">
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">Objet du projet</div>
          <h2 className="serif mt-2 text-[20px] font-bold text-ink">{cv.projectName}</h2>
          <p className="serif mt-2 text-[13px] italic text-ink-2">
            {sectorLabel(cv.sector)}
            {cv.region && ` · ${cv.region}`}
            {' · catégorie '}{cv.category}
          </p>
        </section>

        <section className="mt-7 grid grid-cols-2 gap-x-10 gap-y-5 border-t border-line pt-7">
          <Cell label="Montant agréé" value={formatFcfa(cv.investmentFcfa)} highlight />
          <Cell label="Emplois prévus" value={cv.jobsPlanned.toLocaleString('fr-FR')} highlight />
        </section>

        <section className="mt-7 grid grid-cols-2 gap-x-10 gap-y-5 border-t border-line pt-7">
          <Cell
            label="N° de récépissé"
            value={cv.recepisseNo ?? '—'}
            mono
          />
          <Cell
            label="Date de récépissé"
            value={cv.recepisseAt ? formatDate(cv.recepisseAt) : '—'}
          />
          <Cell
            label="Étape actuelle"
            value={isSigned ? '✓ Convention signée' : stageLabel(cv.currentStage)}
          />
          <Cell
            label="Date de signature"
            value={cv.signedAt ? formatDate(cv.signedAt) : '—'}
          />
        </section>

        <section className="mt-12 grid grid-cols-2 gap-12 border-t border-line pt-10">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">Pour l&apos;investisseur</div>
            <div className="mt-12 border-b border-ink-3 pb-1" />
            <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-3">
              {cv.investor.contactName ?? cv.investor.raisonSociale}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-3">Pour l&apos;État du Cameroun</div>
            <div className="mt-12 border-b border-ink-3 pb-1" />
            <div className="mt-2 text-[11px] uppercase tracking-[0.14em] text-ink-3">
              {cv.signer?.name ?? 'Directeur Général · API'}
            </div>
            {cv.signedAt && (
              <div className="mt-1 text-[10.5px] italic text-ink-4">
                Yaoundé, le {formatDate(cv.signedAt)}
              </div>
            )}
          </div>
        </section>

        <footer className="mt-14 border-t border-line pt-4 text-center text-[10px] uppercase tracking-[0.16em] text-ink-4">
          ⚜ Délivrée en application de l&apos;Ordonnance n° 2025/002 du 18 juillet 2025 ⚜
        </footer>
      </article>
    </main>
  );
}

function Cell({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-3">{label}</div>
      <div className={
        'mt-1 ' +
        (highlight ? 'serif text-[20px] font-semibold text-cmgreen-800 ' : 'text-[14px] font-semibold text-ink ') +
        (mono ? 'font-mono text-[12.5px] tracking-tight' : '')
      }>
        {value}
      </div>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
