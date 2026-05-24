import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { fiscalYearOptions } from '@/lib/obligations-config';
import { formatFcfaCompact } from '@/lib/fcfa';
import { AnnualReportForm } from './AnnualReportForm';

export const metadata = { title: 'Rapport annuel · Art. 32' };
export const dynamic = 'force-dynamic';

export default async function AnnualReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');
  const { id } = await params;
  const { year } = await searchParams;

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id }, select: { id: true },
  });
  if (!investor) redirect('/investor');

  const cv = await db.convention.findUnique({
    where: { id },
    include: { annualReports: { orderBy: { fiscalYear: 'desc' } } },
  });
  if (!cv || cv.investorId !== investor.id) notFound();
  if (cv.status !== 'SIGNED' && cv.status !== 'CLOSED') redirect(`/investor/conventions/${id}`);

  const yearOptions = fiscalYearOptions();
  const selectedYear = year ? Number(year) : yearOptions[yearOptions.length - 2]; // default = year-1

  const existing = cv.annualReports.find((r) => r.fiscalYear === selectedYear);
  const history = cv.annualReports;

  return (
    <section className="mx-auto max-w-5xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Art. 32 · Rapport annuel
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
        Rapport annuel d&apos;exécution
      </h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        Convention {cv.reference} · {cv.projectName}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="border border-line bg-white p-7">
          <AnnualReportForm
            conventionId={cv.id}
            yearOptions={yearOptions}
            defaultYear={selectedYear}
            existing={existing ? {
              fiscalYear: existing.fiscalYear,
              jobsActual: existing.jobsActual,
              investmentActualFcfa: existing.investmentActualFcfa ? existing.investmentActualFcfa.toString() : null,
              exportsActualFcfa: existing.exportsActualFcfa ? existing.exportsActualFcfa.toString() : null,
              localPurchasesFcfa: existing.localPurchasesFcfa ? existing.localPurchasesFcfa.toString() : null,
              notes: existing.notes,
              isLate: existing.isLate,
              monthsLate: existing.monthsLate,
              fineAccruedFcfa: existing.fineAccruedFcfa.toString(),
            } : null}
          />
        </div>

        <aside className="space-y-4">
          <div className="border-l-4 border-gold-600 bg-white p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-700">
              ⚜ Engagements de la convention
            </div>
            <dl className="mt-3 space-y-2 text-[12.5px] text-ink-2">
              <Row label="Investissement agréé" value={formatFcfaCompact(cv.investmentFcfa)} />
              <Row label="Emplois prévus" value={cv.jobsPlanned.toLocaleString('fr-FR')} />
              <Row label="Catégorie" value={cv.category} />
            </dl>
          </div>

          <div className="border-l-4 border-cmred bg-cmred-50/40 p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cmred">
              ⚠ Délai légal
            </div>
            <p className="mt-2 text-[12px] text-ink-2">
              Hard deadline&nbsp;: <strong>31 mars</strong> de l&apos;année suivant
              l&apos;exercice. Tout retard entraîne une pénalité de{' '}
              <strong>1 M FCFA / mois</strong> (Art. 32.3).
            </p>
          </div>

          {history.length > 0 && (
            <div className="border border-line bg-white p-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-3">
                Historique
              </div>
              <ul className="mt-3 space-y-2 text-[12px]">
                {history.map((r) => (
                  <li key={r.id} className="flex items-center justify-between">
                    <span className="font-mono text-ink-2">Exercice {r.fiscalYear}</span>
                    <Link
                      href={`/investor/conventions/${cv.id}/annual-report?year=${r.fiscalYear}`}
                      className="text-cmgreen-800 hover:underline"
                    >
                      Voir / mettre à jour
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={`/investor/conventions/${cv.id}/obligations`}
            className="block border border-line-2 bg-white px-4 py-2.5 text-center text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink"
          >
            ← Obligations
          </Link>
        </aside>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-t border-line pt-2 first:border-t-0 first:pt-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
