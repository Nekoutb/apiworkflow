import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');

  // Anyone who isn't an investor lands on the staff dashboard instead.
  if (session.user.role && session.user.role !== 'INVESTOR') {
    redirect('/dashboard');
  }

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
    select: { raisonSociale: true, isExisting: true },
  });

  return (
    <div className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        République du Cameroun{' '}
        <span className="mx-3 text-gold-500">⚜</span>
        Espace Investisseur
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <Link
            href="/investor"
            className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500"
            aria-label="Espace Investisseur — accueil"
          >
            A
            <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
          </Link>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Espace Investisseur
            </div>
            <div className="serif text-[17px] font-bold text-ink">
              {investor?.raisonSociale ?? 'Mon compte'}
            </div>
          </div>
          <nav className="ml-8 hidden gap-6 md:flex">
            <Link
              href="/investor"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
            >
              Mes dossiers
            </Link>
            <Link
              href="/investor/new"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
            >
              Nouveau dossier
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">
                {session.user.name ?? session.user.email}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
                {investor?.isExisting ? 'Investisseur · convention en cours' : 'Investisseur'}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
