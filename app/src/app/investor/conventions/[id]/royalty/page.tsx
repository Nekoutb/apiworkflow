import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatFcfa, formatFcfaCompact } from '@/lib/fcfa';
import { computeRoyalty, fiscalYearOptions } from '@/lib/obligations-config';
import { RoyaltyForm } from './RoyaltyForm';

export const metadata = { title: 'Redevance annuelle · Art. 48' };
export const dynamic = 'force-dynamic';

export default async function RoyaltyPage({ params, searchParams }: {
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
    include: { royaltyPayments: { orderBy: { fiscalYear: 'desc' } } },
  });
  if (!cv || cv.investorId !== investor.id) notFound();
  if (cv.status !== 'SIGNED' && cv.status !== 'CLOSED') redirect(`/investor/conventions/${id}`);

  const years = fiscalYearOptions();
  const selectedYear = year ? Number(year) : years[years.length - 1];
  const existing = cv.royaltyPayments.find((r) => r.fiscalYear === selectedYear);
  const amountDue = computeRoyalty(cv.investmentFcfa);
  const rawCalc = cv.investmentFcfa / 1000n; // 0.1%

  return (
    <section className="mx-auto max-w-5xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Art. 48 · Redevance annuelle
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
        Redevance annuelle de l&apos;API
      </h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        Convention {cv.reference} · {cv.projectName}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="border border-line bg-white p-7">
          <RoyaltyForm
            conventionId={cv.id}
            years={years}
            defaultYear={selectedYear}
            amountDueFcfaStr={amountDue.toString()}
            existing={existing ? {
              fiscalYear: existing.fiscalYear,
              amountPaidFcfa: existing.amountPaidFcfa ? existing.amountPaidFcfa.toString() : null,
              paidAt: existing.paidAt ? existing.paidAt.toISOString() : null,
              status: existing.status,
            } : null}
          />
        </div>

        <aside className="space-y-4">
          <div className="border-l-4 border-gold-600 bg-white p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-700">
              ⚜ Calcul Art. 48
            </div>
            <dl className="mt-3 space-y-2 text-[12px]">
              <Row label="Montant agréé" value={formatFcfaCompact(cv.investmentFcfa)} />
              <Row label="Taux" value="0,1 %" />
              <Row label="Calcul brut" value={formatFcfa(rawCalc)} dim />
              <Row label="Plancher" value="100 000 FCFA" dim />
              <Row label="Plafond" value="5 000 000 FCFA" dim />
              <Row label="Redevance due" value={formatFcfa(amountDue)} highlight />
            </dl>
          </div>

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

function Row({ label, value, dim, highlight }: { label: string; value: string; dim?: boolean; highlight?: boolean }) {
  return (
    <div className={'flex items-baseline justify-between gap-2 border-t border-line pt-2 first:border-t-0 first:pt-0 ' + (highlight ? 'border-t-cmgreen-700/40 pt-2.5' : '')}>
      <dt className={dim ? 'text-[11px] italic text-ink-4' : 'text-ink-3'}>{label}</dt>
      <dd className={'font-mono tabular ' + (highlight ? 'text-[14px] font-bold text-cmgreen-800' : dim ? 'text-[11px] italic text-ink-4' : 'font-semibold text-ink')}>
        {value}
      </dd>
    </div>
  );
}
