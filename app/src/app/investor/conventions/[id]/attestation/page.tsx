import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { AttestationForm } from './AttestationForm';

export const metadata = { title: 'Attestation de réalisation · Art. 34' };
export const dynamic = 'force-dynamic';

export default async function AttestationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');
  const { id } = await params;

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id }, select: { id: true },
  });
  if (!investor) redirect('/investor');

  const cv = await db.convention.findUnique({
    where: { id },
    include: { attestationRequest: true },
  });
  if (!cv || cv.investorId !== investor.id) notFound();
  if (cv.status !== 'SIGNED' && cv.status !== 'CLOSED') redirect(`/investor/conventions/${id}`);

  const existing = cv.attestationRequest;

  return (
    <section className="mx-auto max-w-5xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Art. 34 · Attestation de réalisation
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
        Demande d&apos;attestation de réalisation
      </h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        Convention {cv.reference} · {cv.projectName}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="border border-line bg-white p-7">
          <AttestationForm
            conventionId={cv.id}
            existing={existing ? {
              expectedCompletionDate: existing.expectedCompletionDate.toISOString().slice(0, 10),
              notes: existing.notes,
              status: existing.status,
              inspectionScheduledAt: existing.inspectionScheduledAt?.toISOString() ?? null,
            } : null}
          />
        </div>

        <aside className="space-y-4">
          <div className="border-l-4 border-gold-600 bg-white p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-700">
              ⚜ Procédure Art. 34
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-2">
              À la fin de la phase d&apos;installation, l&apos;investisseur sollicite une attestation
              de réalisation. Cette demande déclenche une <strong>visite conjointe API + DGI + DGD</strong> sur
              le site, qui constate la réalisation effective. L&apos;attestation conditionne le
              passage en phase d&apos;exploitation.
            </p>
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
