import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Logo } from '@/components/brand/Logo';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { NewDossierForm } from './NewDossierForm';

export const metadata = { title: 'Nouvelle demande · API Cameroun' };
export const dynamic = 'force-dynamic';

export default async function NewDossierPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.userType !== 'INVESTOR') redirect('/staff');

  // If the investor already has a DRAFT, redirect them to its detail page instead
  const profile = await db.investorProfile.findFirst({
    where: { userId: session.user.id ?? '' },
  });
  if (profile) {
    const draft = await db.dossier.findFirst({
      where: { investorProfileId: profile.id, state: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
    });
    if (draft) redirect(`/investor/dossier/${draft.id}`);
  }

  const zdps = await db.zdpLocality.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });

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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/investor" className="mb-4 inline-flex items-center gap-1.5 text-sm text-cmgreen-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
        </Link>

        <h1 className="text-2xl font-bold">Nouvelle demande d&apos;agrément</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Étape 1 sur 2 : décrivez votre projet. Vous téléverserez les pièces justificatives à l&apos;étape suivante.
        </p>

        <div className="mt-3 rounded-lg bg-info-bg p-3 text-xs text-info">
          📋 Cette demande sera traitée selon l&apos;Ordonnance n° 2025/002 — délai légal d&apos;instruction de 10 jours ouvrés à compter du récépissé de dépôt (Art. 30.3).
        </div>

        <NewDossierForm zdps={zdps.map((z) => ({ id: z.id, name: z.name }))} />
      </main>
    </div>
  );
}
