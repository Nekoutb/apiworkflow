import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { LogoutButton } from '@/components/LogoutButton';
import { roleLabel, isStaffRole } from '@/lib/roles';
import { stageForRole, ROLE_SUBTITLE_FR } from '@/lib/staff-corbeille';
import type { StaffRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=staff');

  const role = session.user.role;
  // Investors shouldn't be here.
  if (role === 'INVESTOR') redirect('/investor');
  if (!isStaffRole(role)) redirect('/');

  const staffRole = role as StaffRole;
  const subtitle = ROLE_SUBTITLE_FR[staffRole] ?? 'Portail interne';
  const stage = stageForRole(staffRole);

  // Counts for the sidebar
  const corbeilleCount = stage
    ? await db.convention.count({
        where: { status: 'SUBMITTED', currentStage: stage },
      })
    : await db.convention.count({ where: { status: 'SUBMITTED' } });

  const recentCount = await db.workflowEvent.count({
    where: { actorUserId: session.user.id, action: { in: ['SIGNED_OFF', 'HANDED_OFF', 'RECEIPT_ISSUED'] } },
  });

  const allCount = await db.convention.count();

  const initials = makeInitials(session.user.name ?? session.user.email ?? '?');

  return (
    <div className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span> Workflow d&apos;agrément{' '}
        <span className="mx-3 text-gold-500">⚜</span> {roleLabel(staffRole, true)}
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-7 py-4">
          <Link
            href="/staff/inbox"
            className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500"
          >
            A
            <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
          </Link>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Portail interne · API Cameroun
            </div>
            <div className="serif text-[17px] font-bold text-ink">Workflow d&apos;agrément</div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {role === 'ADMIN' && (
              <Link
                href="/dashboard"
                className="border border-line-2 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-2 hover:border-ink hover:text-ink"
              >
                Espace admin
              </Link>
            )}
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">
                {session.user.name ?? session.user.email}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
                {subtitle}
              </div>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center bg-cmgreen-800 text-[12px] font-bold text-white"
              aria-hidden
            >
              {initials}
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-[260px_1fr]">
        <aside className="border-r border-line bg-obsidian py-7 text-white/90 min-h-[calc(100vh-110px)]">
          <SidebarSection title="Workflow">
            <NavLink href="/staff/inbox" label="Ma corbeille" count={corbeilleCount} />
            <NavLink href="/staff/recent" label="Récemment traités" count={recentCount} />
            <NavLink href="/staff/all"    label="Toutes les conventions" count={allCount} muted />
          </SidebarSection>

          <SidebarSection title="Mon rôle" className="mt-7">
            <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-500">
              {roleLabel(staffRole)}
            </div>
            <div className="px-4 text-[10.5px] italic leading-snug text-white/55">
              {stage
                ? `Stage ${stageNumber(stage)}/5 du workflow d'agrément`
                : 'Vue globale (administrateur)'}
            </div>
          </SidebarSection>

          {role === 'ADMIN' && (
            <SidebarSection title="Administration" className="mt-7">
              <NavLink href="/admin/users" label="Gestion du personnel" external />
              <NavLink href="/admin/data"  label="Aperçu des données"   external />
            </SidebarSection>
          )}
        </aside>

        <main className="bg-bgsoft">{children}</main>
      </div>
    </div>
  );
}

function SidebarSection({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="px-4 pb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-gold-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function NavLink({ href, label, count, muted, external }: {
  href: string; label: string; count?: number; muted?: boolean; external?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        'flex items-center justify-between px-4 py-2 text-[12.5px] transition hover:bg-white/[0.06] ' +
        (muted ? 'text-white/55' : 'text-white/85')
      }
    >
      <span className="flex items-center gap-2">
        {label}
        {external && <span className="text-[10px] text-gold-500">↗</span>}
      </span>
      {typeof count === 'number' && (
        <span className={'min-w-[24px] border px-1.5 py-0.5 text-center text-[10px] font-bold ' +
          (count > 0
            ? 'border-gold-500 bg-gold-500/15 text-gold-500'
            : 'border-white/15 text-white/40')}>
          {count}
        </span>
      )}
    </Link>
  );
}

function makeInitials(s: string): string {
  return s.split(/\s+|@|\./).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase() ?? '').join('') || '?';
}

function stageNumber(stage: string): number {
  const order = ['SECRETARY', 'DIR_INVESTMENTS', 'DIR_COMPLIANCE', 'DIR_EXTERNAL', 'DG'];
  return order.indexOf(stage) + 1;
}
