import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { LogoutButton } from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span> Administration{' '}
        <span className="mx-3 text-gold-500">⚜</span> Gestion du personnel
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <Link
            href="/dashboard"
            className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500"
            aria-label="Retour au tableau de bord"
          >
            A
            <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
          </Link>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Portail interne · Administration
            </div>
            <div className="serif text-[17px] font-bold text-ink">Personnel &amp; Rôles</div>
          </div>
          <nav className="ml-8 hidden gap-6 md:flex">
            <Link
              href="/dashboard"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
            >
              Tableau de bord
            </Link>
            <Link
              href="/admin/users"
              className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink"
            >
              Personnel
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">
                {session.user.name ?? session.user.email}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
                Administrateur
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
