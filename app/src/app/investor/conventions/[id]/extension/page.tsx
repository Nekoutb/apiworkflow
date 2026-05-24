import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { ExtensionForm } from './ExtensionForm';
import { submissionStatusClass, SUBMISSION_STATUS_LABEL, type SubmissionStatus } from '@/lib/obligations-config';

export const metadata = { title: 'Demande d\'extension · Art. 36' };
export const dynamic = 'force-dynamic';

export default async function ExtensionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');
  const { id } = await params;

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id }, select: { id: true },
  });
  if (!investor) redirect('/investor');

  const cv = await db.convention.findUnique({
    where: { id },
    include: { extensionRequests: { orderBy: { submittedAt: 'desc' } } },
  });
  if (!cv || cv.investorId !== investor.id) notFound();
  if (cv.status !== 'SIGNED' && cv.status !== 'CLOSED') redirect(`/investor/conventions/${id}`);

  const history = cv.extensionRequests;

  return (
    <section className="mx-auto max-w-5xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Art. 36 · Extension de délai
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
        Demande d&apos;extension de délai
      </h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        Convention {cv.reference} · {cv.projectName}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
        <div className="border border-line bg-white p-7">
          <ExtensionForm conventionId={cv.id} />

          {history.length > 0 && (
            <div className="mt-10 border-t border-line pt-6">
              <h3 className="serif text-[16px] font-bold text-ink">Demandes précédentes</h3>
              <ul className="mt-4 space-y-3">
                {history.map((r) => (
                  <li key={r.id} className="border border-line bg-bgsoft p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[12.5px] font-semibold text-ink">
                          {r.requestedMonths} mois demandés
                          <span className="ml-2 text-[11px] uppercase tracking-[0.12em] text-ink-3">
                            · {r.submittedAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                        <blockquote className="serif mt-1.5 text-[12.5px] italic text-ink-2">« {r.reason} »</blockquote>
                        {r.decisionNotes && (
                          <div className="mt-2 text-[11.5px] text-ink-3">
                            <strong className="text-ink-2">Décision&nbsp;:</strong> {r.decisionNotes}
                          </div>
                        )}
                      </div>
                      <span className={`pill ${submissionStatusClass(r.status as SubmissionStatus)} flex-none`}>
                        {SUBMISSION_STATUS_LABEL[r.status as SubmissionStatus]}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="border-l-4 border-gold-600 bg-white p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-700">
              ⚜ Conditions Art. 36
            </div>
            <ul className="mt-3 space-y-2 text-[12px] text-ink-2">
              <Li>Force majeure ou difficulté économique avérée</Li>
              <Li>Extension max 24 mois, non-renouvelable (Art. 36.3)</Li>
              <Li>Avis obligatoire DGI + DGD au Guichet Unique</Li>
              <Li>Pièces justificatives chiffrées attendues</Li>
            </ul>
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

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-gold-600" />
      <span>{children}</span>
    </li>
  );
}
