import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NewProjectForm } from './NewProjectForm';

export const metadata = { title: 'Nouveau dossier · Espace Investisseur' };
export const dynamic = 'force-dynamic';

export default async function NewDossierPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
    include: {
      conventions: {
        where: { status: 'DRAFT' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, reference: true, projectName: true },
      },
    },
  });

  if (!investor) redirect('/investor');

  // If a DRAFT already exists, send the investor straight to the upload page.
  const draft = investor.conventions[0];
  if (draft) redirect(`/investor/conventions/${draft.id}/edit`);

  return (
    <section className="mx-auto max-w-3xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Dossier · Demande d&apos;agrément
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
        Nouvelle demande d&apos;incitations
      </h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        {investor.raisonSociale} — décrivez d&apos;abord votre projet. Vous téléverserez ensuite les
        pièces obligatoires.
      </p>

      <div className="mt-10 border border-line bg-white p-7">
        <NewProjectForm />
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/investor"
          className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
        >
          ← Retour à mon espace
        </Link>
      </div>
    </section>
  );
}
