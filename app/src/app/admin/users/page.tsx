import Link from 'next/link';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';

export const metadata = { title: 'Personnel · Administration · API Cameroun' };
export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const users = await db.user.findMany({
    where: { userType: 'STAFF' },
    orderBy: [{ status: 'asc' }, { staffRole: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, name: true, email: true, staffRole: true, status: true, createdAt: true,
      antenne: { select: { name: true } },
    },
  });

  return (
    <section className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        Administration · v2
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">Personnel API</h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        {users.length} compte{users.length > 1 ? 's' : ''} actuellement seedé{users.length > 1 ? 's' : ''}.
      </p>

      <div className="mt-6 border-l-4 border-gold-600 bg-gold-50/60 px-4 py-3 text-[12.5px] leading-relaxed text-ink-2">
        <strong className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-gold-700">
          Activité B2 à venir
        </strong>
        Le formulaire de création des comptes (avec picker hiérarchique groupé par sous-direction)
        sera livré à l'activité <strong>B2</strong>. Pour l'instant, seuls les comptes seedés sont
        visibles. Le mot de passe universel est <code className="font-mono">admin</code>.
      </div>

      <div className="mt-8 border border-line bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-bgsoft text-left">
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Nom</th>
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Email</th>
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Rôle</th>
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Antenne</th>
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[13px] italic text-ink-3">
                  Aucun compte personnel.
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3.5 text-[13.5px] font-semibold text-ink">{u.name ?? '—'}</td>
                <td className="px-4 py-3.5 font-mono text-[12.5px] text-ink-2">{u.email}</td>
                <td className="px-4 py-3.5 text-[12.5px] text-ink-2">{roleLabel(u.staffRole)}</td>
                <td className="px-4 py-3.5 text-[11.5px] text-ink-3">{u.antenne?.name ?? '—'}</td>
                <td className="px-4 py-3.5 text-[11.5px] text-ink-2">{u.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <Link href="/admin/data" className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink">
          Aperçu base de données →
        </Link>
      </div>
    </section>
  );
}
