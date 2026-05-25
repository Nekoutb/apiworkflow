import { Link } from '@/i18n/navigation';
import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { ROLES, ROLE_GROUP_LABEL_FR, type RoleGroup } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';
import { CreateUserForm } from './CreateUserForm';
import { CreateAntenneForm } from './CreateAntenneForm';
import { UserRow, type UserRowData } from './UserRow';

export const metadata = { title: 'Personnel · Administration · API Cameroun' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  // The middleware whitelists /admin/users for authenticated users;
  // we add an explicit ADMIN check here so non-admins get redirected.
  if (session?.user?.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  const [users, antennes] = await Promise.all([
    db.user.findMany({
      where: { userType: 'STAFF' },
      orderBy: [{ status: 'asc' }, { staffRole: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        email: true,
        staffRole: true,
        status: true,
        antenneId: true,
        antenne: { select: { name: true } },
      },
    }),
    db.antenne.findMany({
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, region: true, active: true },
    }),
  ]);

  // Bucket users by role group for the grouped table
  type Bucket = {
    group: RoleGroup;
    label: string;
    rows: UserRowData[];
    rolesInGroupCount: number;
  };
  const rolesByRole = new Map(ROLES.map((r) => [r.role, r]));

  const buckets: Bucket[] = (Object.keys(ROLE_GROUP_LABEL_FR) as RoleGroup[]).map((g) => ({
    group: g,
    label: ROLE_GROUP_LABEL_FR[g],
    rows: [],
    rolesInGroupCount: ROLES.filter((r) => r.group === g).length,
  }));
  const bucketByGroup = new Map(buckets.map((b) => [b.group, b]));

  const unassigned: UserRowData[] = [];
  for (const u of users) {
    const row: UserRowData = {
      id: u.id,
      name: u.name,
      email: u.email,
      staffRole: u.staffRole,
      status: u.status,
      antenneId: u.antenneId,
      antenneName: u.antenne?.name ?? null,
      isSelf: u.id === session.user!.id,
    };
    const meta = u.staffRole ? rolesByRole.get(u.staffRole) : undefined;
    const target = meta ? bucketByGroup.get(meta.group) : undefined;
    if (target) target.rows.push(row);
    else unassigned.push(row);
  }

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'ACTIVE').length;
  const totalRoles = ROLES.length;
  const filledRoles = new Set(
    users.filter((u) => u.status === 'ACTIVE' && u.staffRole).map((u) => u.staffRole as StaffRole),
  ).size;

  return (
    <section className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        Administration · v2 · B2
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">Personnel API</h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        Organigramme officiel — {totalRoles} rôles définis · {filledRoles} pourvus · {activeUsers} actif{activeUsers !== 1 ? 's' : ''} ({totalUsers} compte{totalUsers > 1 ? 's' : ''} au total).
      </p>

      {/* Stat strip */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Comptes actifs" value={activeUsers} />
        <Stat label="Rôles pourvus" value={`${filledRoles} / ${totalRoles}`} />
        <Stat label="Antennes" value={`${antennes.filter((a) => a.active).length} active(s)`} />
        <Stat label="Mot de passe initial" value="admin" mono />
      </div>

      {/* Create forms */}
      <div className="mt-10 space-y-4">
        <CreateUserForm antennes={antennes} />
        <CreateAntenneForm />
      </div>

      {/* Antennes list */}
      <h2 className="serif mt-12 mb-4 text-[20px] font-semibold tracking-[-0.3px] text-ink">
        Antennes régionales
      </h2>
      <div className="border border-line bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-bgsoft text-left">
              <Th>Nom</Th>
              <Th>Région</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {antennes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-[12.5px] italic text-ink-3">
                  Aucune antenne créée. Ajoutez-en une via le formulaire ci-dessus.
                </td>
              </tr>
            )}
            {antennes.map((a) => (
              <tr key={a.id} className={'border-t border-line ' + (a.active ? '' : 'opacity-55')}>
                <td className="px-4 py-3 text-[13.5px] font-semibold text-ink">{a.name}</td>
                <td className="px-4 py-3 text-[12.5px] text-ink-2">{a.region}</td>
                <td className="px-4 py-3 text-[11.5px]">
                  <span
                    className={
                      'inline-block px-2 py-0.5 font-bold uppercase tracking-[0.1em] text-[10px] ' +
                      (a.active ? 'bg-cmgreen-50 text-cmgreen-900' : 'bg-ink-4/15 text-ink-3')
                    }
                  >
                    {a.active ? 'active' : 'archivée'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Personnel grouped by organigramme group */}
      <h2 className="serif mt-12 mb-4 text-[20px] font-semibold tracking-[-0.3px] text-ink">
        Personnel par groupe organigramme
      </h2>

      <div className="space-y-6">
        {buckets.map((b) => (
          <div key={b.group} className="border border-line bg-white">
            <div className="flex items-baseline justify-between border-b border-line bg-bgsoft px-4 py-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-2">
                {b.label}
              </h3>
              <span className="text-[10.5px] uppercase tracking-[0.14em] text-ink-3">
                {b.rows.filter((r) => r.status === 'ACTIVE').length} / {b.rolesInGroupCount} rôle{b.rolesInGroupCount > 1 ? 's' : ''} pourvu{b.rows.filter((r) => r.status === 'ACTIVE').length > 1 ? 's' : ''}
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <Th className="w-[16%]">Nom</Th>
                  <Th className="w-[22%]">Email</Th>
                  <Th className="w-[26%]">Rôle</Th>
                  <Th className="w-[12%]">Antenne</Th>
                  <Th>Statut · Actions</Th>
                </tr>
              </thead>
              <tbody>
                {b.rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-5 text-center text-[12px] italic text-ink-4">
                      Aucun compte dans ce groupe.
                    </td>
                  </tr>
                ) : (
                  b.rows.map((u) => <UserRow key={u.id} user={u} antennes={antennes} />)
                )}
              </tbody>
            </table>
          </div>
        ))}

        {unassigned.length > 0 && (
          <div className="border border-cmred bg-white">
            <div className="border-b border-cmred bg-cmred-50 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cmred">
              ⚠ Comptes sans rôle valide
            </div>
            <table className="w-full">
              <tbody>
                {unassigned.map((u) => (
                  <UserRow key={u.id} user={u} antennes={antennes} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-10 flex items-center gap-3">
        <Link
          href="/admin/data"
          className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
        >
          ← Aperçu base de données
        </Link>
        <Link
          href="/dashboard"
          className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
        >
          Tableau de bord →
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="border border-line bg-white px-4 py-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div
        className={
          'mt-1 text-[20px] font-semibold text-ink ' + (mono ? 'font-mono tracking-tight' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        'px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3 ' +
        (className ?? '')
      }
    >
      {children}
    </th>
  );
}
