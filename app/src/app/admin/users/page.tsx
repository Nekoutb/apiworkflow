import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { CreateStaffForm } from './CreateStaffForm';
import { UserRow, type UserRowData } from './UserRow';

export const metadata = { title: 'Personnel · Administration · API Cameroun' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;

  const users = await db.user.findMany({
    where: { userType: 'STAFF' },
    orderBy: [{ status: 'asc' }, { staffRole: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      staffRole: true,
      status: true,
      createdAt: true,
    },
  });

  const rowData: UserRowData[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.staffRole,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    isCurrentUser: u.id === currentUserId,
  }));

  const activeCount = users.filter((u) => u.status === 'ACTIVE').length;
  const rolesCovered = new Set(
    users.filter((u) => u.status === 'ACTIVE' && u.staffRole).map((u) => u.staffRole),
  ).size;
  const mostRecent = users.length
    ? users.reduce((acc, u) => (u.createdAt > acc.createdAt ? u : acc))
    : null;

  return (
    <section className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        Administration
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">Personnel API</h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        {activeCount} compte{activeCount > 1 ? 's' : ''} actif{activeCount > 1 ? 's' : ''} · {rolesCovered} rôle
        {rolesCovered > 1 ? 's' : ''} couvert{rolesCovered > 1 ? 's' : ''}
        {mostRecent && (
          <> · dernière création {formatRelative(mostRecent.createdAt)}</>
        )}
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="border border-line bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-bgsoft text-left">
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  Nom complet
                </th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  Email
                </th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  Rôle
                </th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  Statut
                </th>
                <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rowData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[13px] italic text-ink-3">
                    Aucun compte personnel. Créez le premier ci-contre.
                  </td>
                </tr>
              )}
              {rowData.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <CreateStaffForm />
        </div>
      </div>
    </section>
  );
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
