import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel, roleMeta } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';

export const metadata = { title: 'Parapheur de l\'unité · API Cameroun' };
export const dynamic = 'force-dynamic';

// DG / DGA have their own /dg/parapheur — they don't belong here.
const FORBIDDEN: StaffRole[] = ['DG', 'DGA'];

const NATURE_SHORT: Record<string, string> = {
  AGREMENT_REQUEST: "Demande d'agrément",
  GENERAL_CORRESPONDENCE: 'Correspondance',
  OFFICIAL_NOTIFICATION: 'Notification',
  PARTNERSHIP_PROPOSAL: 'Partenariat',
  COMPLAINT: 'Réclamation',
  REPORT: 'Rapport',
  OTHER: 'Autre',
};

const STATUS_LABEL: Record<string, string> = {
  ASSIGNED:     'À prendre en charge',
  IN_TREATMENT: 'En traitement',
};

export default async function UnitParapheurPage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || FORBIDDEN.includes(role)) redirect('/dashboard');

  // ADMIN sees every active assignment; otherwise filter by the user's role.
  const assignmentWhere =
    role === 'ADMIN' ? { status: 'ACTIVE' as const } : { status: 'ACTIVE' as const, assignedToRole: role };

  const [active, inTreatment, returnedTotal, completedTotal] = await Promise.all([
    db.assignment.findMany({
      where: assignmentWhere,
      orderBy: { assignedAt: 'asc' }, // oldest first
      take: 100,
      select: {
        id: true,
        assignedAt: true,
        assignedToRole: true,
        instructions: true,
        document: {
          select: {
            id: true,
            reference: true,
            subject: true,
            nature: true,
            status: true,
            submittedAt: true,
            submission: {
              select: { senderName: true, senderEmail: true, senderOrganization: true },
            },
          },
        },
        assignedBy: { select: { name: true, email: true } },
      },
    }),
    db.assignment.count({
      where: {
        ...assignmentWhere,
        document: { status: 'IN_TREATMENT' },
      },
    }),
    db.assignment.count({
      where:
        role === 'ADMIN'
          ? { status: 'RETURNED' }
          : { status: 'RETURNED', assignedToRole: role },
    }),
    db.assignment.count({
      where:
        role === 'ADMIN'
          ? { status: 'COMPLETED' }
          : { status: 'COMPLETED', assignedToRole: role },
    }),
  ]);

  const oldestWaiting = active.find((a) => a.document.status === 'ASSIGNED');
  const oldestAgeMs = oldestWaiting ? Date.now() - oldestWaiting.assignedAt.getTime() : 0;

  const myRoleMeta = roleMeta(role);
  const headerLabel =
    role === 'ADMIN'
      ? 'Parapheur universel (vue admin · toutes les unités)'
      : `Parapheur — ${myRoleMeta?.fr ?? roleLabel(role)}`;

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span>
        Unité <span className="mx-3 text-gold-500">⚜</span>
        Parapheur
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Portail interne · Unité
            </div>
            <div className="serif text-[17px] font-bold text-ink">{headerLabel}</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">
                {session.user.name ?? session.user.email}
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
                {roleLabel(role)}
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-10">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Affectations actives"  value={active.length} accent />
          <Stat label="En traitement"          value={inTreatment} />
          <Stat label="Doyen en file"          value={oldestWaiting ? humanAge(oldestAgeMs) : '—'} mono />
          <Stat label="Renvoyés · clôturés"    value={`${returnedTotal} · ${completedTotal}`} mono />
        </div>

        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          {role === 'ADMIN' ? 'Toutes les affectations actives' : 'Mes affectations actives'}
        </h2>
        <p className="serif mb-4 text-[12.5px] italic text-ink-3">
          Documents dispatchés par le DG vers votre unité (via le Service du Courrier · règle B14.5).
          Triés du plus ancien au plus récent. Cliquez pour ouvrir le détail et prendre en charge le
          dossier ou le renvoyer au DG.
        </p>

        {active.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            {role === 'ADMIN'
              ? 'Aucune affectation active dans aucune unité. Le parapheur se remplit dès qu\'un document est dispatché depuis le DG.'
              : 'Aucune affectation active. Votre parapheur se remplira dès que le DG vous dispatchera un document.'}
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full">
              <thead className="bg-bgsoft">
                <tr className="text-left">
                  <Th>Âge</Th>
                  <Th>Référence</Th>
                  <Th>Émetteur</Th>
                  <Th>Objet</Th>
                  <Th>Nature</Th>
                  <Th>Statut</Th>
                  {role === 'ADMIN' && <Th>Unité cible</Th>}
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {active.map((a) => {
                  const ageMs = Date.now() - a.assignedAt.getTime();
                  const ageClass =
                    ageMs > 7 * 24 * 60 * 60 * 1000 ? 'text-cmred' :
                    ageMs > 3 * 24 * 60 * 60 * 1000 ? 'text-gold-700' :
                    'text-ink-3';
                  const isInTreatment = a.document.status === 'IN_TREATMENT';
                  return (
                    <tr key={a.id} className="border-t border-line align-top">
                      <td className={'px-4 py-3 font-mono text-[11px] font-semibold ' + ageClass}>
                        {humanAge(ageMs)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">
                        {a.document.reference}
                      </td>
                      <td className="px-4 py-3 text-[12.5px]">
                        <div className="font-semibold text-ink">
                          {a.document.submission?.senderName ?? '—'}
                        </div>
                        <div className="text-[11px] text-ink-3">
                          {a.document.submission?.senderEmail}
                        </div>
                        {a.document.submission?.senderOrganization && (
                          <div className="text-[10.5px] italic text-ink-4">
                            {a.document.submission.senderOrganization}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-2">
                        <div className="max-w-md truncate" title={a.document.subject}>
                          {a.document.subject}
                        </div>
                        {a.instructions && (
                          <div
                            className="mt-1 max-w-md truncate text-[10.5px] italic text-gold-700"
                            title={a.instructions}
                          >
                            ⓘ {a.instructions}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-3">
                        {NATURE_SHORT[a.document.nature] ?? a.document.nature}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            'inline-block px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ' +
                            (isInTreatment
                              ? 'bg-cmgreen-50 text-cmgreen-900'
                              : 'bg-gold-50 text-gold-700')
                          }
                        >
                          {STATUS_LABEL[a.document.status] ?? a.document.status}
                        </span>
                      </td>
                      {role === 'ADMIN' && (
                        <td className="px-4 py-3 text-[11px]">
                          <div className="font-semibold text-ink-2">
                            {roleMeta(a.assignedToRole)?.shortFr ?? a.assignedToRole}
                          </div>
                          <div className="font-mono text-[9.5px] text-ink-4">
                            {a.assignedToRole}
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/unit/parapheur/${a.document.id}`}
                          className="bg-cmgreen-800 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900"
                        >
                          Ouvrir →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-10">
          <Link
            href="/dashboard"
            className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            ← Tableau de bord
          </Link>
        </div>
      </section>
    </main>
  );
}

// ----------------------------------------------------------------------------

function humanAge(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)   return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d} j`;
  const mo = Math.floor(d / 30);
  return `${mo} mois`;
}

function Stat({
  label, value, accent, mono,
}: {
  label: string; value: number | string; accent?: boolean; mono?: boolean;
}) {
  return (
    <div className={'border bg-white px-4 py-3.5 ' + (accent ? 'border-cmgreen-700' : 'border-line')}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div
        className={
          'mt-1 text-[24px] font-semibold ' +
          (accent ? 'text-cmgreen-900' : 'text-ink') + ' ' +
          (mono ? 'font-mono' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
      {children}
    </th>
  );
}
