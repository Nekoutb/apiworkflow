import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';
import { AdminMarkDecidedRow } from './AdminMarkDecidedRow';

export const metadata = { title: 'Bureau Départ · API Cameroun' };
export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = ['ADMIN', 'CHEF_BUREAU_DEPART', 'CHEF_SERVICE_COURRIER'];

const NATURE_SHORT: Record<string, string> = {
  AGREMENT_REQUEST: "Demande d'agrément",
  GENERAL_CORRESPONDENCE: 'Correspondance',
  OFFICIAL_NOTIFICATION: 'Notification',
  PARTNERSHIP_PROPOSAL: 'Partenariat',
  COMPLAINT: 'Réclamation',
  REPORT: 'Rapport',
  OTHER: 'Autre',
};

export default async function CourrierDepartPage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || !ALLOWED.includes(role)) redirect('/dashboard');
  const isAdmin = role === 'ADMIN';

  // Awaiting outbound = status DECIDED
  // Recent outbound = status RESPONSE_SENT over the last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [awaiting, recent, todayCount] = await Promise.all([
    db.document.findMany({
      where: { status: 'DECIDED' },
      orderBy: { decidedAt: 'asc' },
      take: 50,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        decidedAt: true,
        submission: {
          select: { senderName: true, senderEmail: true, senderOrganization: true },
        },
      },
    }),
    db.document.findMany({
      where: { status: 'RESPONSE_SENT', responseSentAt: { gte: since } },
      orderBy: { responseSentAt: 'desc' },
      take: 30,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        responseSentAt: true,
        submission: { select: { senderName: true, senderEmail: true } },
      },
    }),
    db.document.count({
      where: { responseSentAt: { gte: startOfDayUTC() } },
    }),
  ]);

  // For the admin shortcut: docs that COULD be promoted (anything not yet
  // decided / sent / closed). Used by the testing helper.
  const promotable = isAdmin
    ? await db.document.findMany({
        where: {
          status: {
            in: [
              'RECEIVED',
              'AWAITING_DG_ANALYSIS',
              'ASSIGNED',
              'IN_TREATMENT',
              'AWAITING_EXTERNAL_AVIS',
              'AWAITING_DG_DECISION',
            ],
          },
        },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: { id: true, reference: true, subject: true, status: true },
      })
    : [];

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span>
        Service du Courrier <span className="mx-3 text-gold-500">⚜</span>
        Bureau Départ
      </div>

      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <Link
            href="/dashboard"
            className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500"
            aria-label="Tableau de bord"
          >
            A
            <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
          </Link>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Portail interne · Service du Courrier
            </div>
            <div className="serif text-[17px] font-bold text-ink">Bureau Départ — Expédition</div>
          </div>
          <div className="ml-auto text-right leading-tight">
            <div className="text-[13px] font-semibold text-ink">{session.user.name ?? session.user.email}</div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleLabel(role)}</div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="En attente d'expédition" value={awaiting.length} accent />
          <Stat label="Expédiés aujourd'hui" value={todayCount} />
          <Stat label="Expédiés (30 jours)" value={recent.length} />
        </div>

        {/* Awaiting outbound */}
        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Décisions prêtes à expédier
        </h2>
        {awaiting.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            Aucun document au statut DECIDED. La file s&apos;alimente quand le DG
            rend une décision (B15).
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full">
              <thead className="bg-bgsoft">
                <tr className="text-left">
                  <Th>Référence</Th>
                  <Th>Émetteur</Th>
                  <Th>Objet</Th>
                  <Th>Nature</Th>
                  <Th>Décidé le</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {awaiting.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">{d.reference}</td>
                    <td className="px-4 py-3 text-[12.5px]">
                      <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                      <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                      {d.submission?.senderOrganization && (
                        <div className="text-[10.5px] italic text-ink-4">{d.submission.senderOrganization}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-2">
                      <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-ink-3">
                      {NATURE_SHORT[d.nature] ?? d.nature}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {d.decidedAt?.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/courrier/depart/${d.id}`}
                        className="bg-cmgreen-800 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-cmgreen-900"
                      >
                        Composer →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Admin testing helper */}
        {isAdmin && (
          <div className="mt-10 border-2 border-dashed border-gold-700 bg-gold-50/40 px-5 py-5">
            <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-gold-700">
              ⚠ Admin · raccourci de test
            </div>
            <h3 className="serif text-[16px] font-semibold text-ink">
              Promouvoir un document au statut DECIDED
            </h3>
            <p className="serif mt-1 text-[12.5px] italic text-ink-3">
              Tant que le flux de décision DG (B15) n&apos;est pas construit,
              utilisez ce bouton pour pousser un document directement au statut
              DECIDED afin de tester l&apos;expédition. <strong>À retirer en B15.</strong>
            </p>
            {promotable.length === 0 ? (
              <p className="serif mt-3 text-[12px] italic text-ink-4">
                Aucun document en cours à promouvoir.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto bg-white">
                <table className="w-full">
                  <thead className="bg-bgsoft">
                    <tr className="text-left">
                      <Th>Référence</Th>
                      <Th>Objet</Th>
                      <Th>Statut actuel</Th>
                      <Th>Action</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotable.map((d) => (
                      <AdminMarkDecidedRow key={d.id} doc={d} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Recent outbound */}
        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Récemment expédiés
        </h2>
        {recent.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            Aucun document expédié récemment.
          </div>
        ) : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="w-full">
              <thead className="bg-bgsoft">
                <tr className="text-left">
                  <Th>Référence</Th>
                  <Th>Émetteur</Th>
                  <Th>Objet</Th>
                  <Th>Expédié le</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">{d.reference}</td>
                    <td className="px-4 py-3 text-[12.5px]">
                      <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                      <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-ink-2">
                      <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {d.responseSentAt?.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) ?? '—'}
                    </td>
                  </tr>
                ))}
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

function startOfDayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={'border bg-white px-4 py-3.5 ' + (accent ? 'border-cmgreen-700' : 'border-line')}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div className={'mt-1 text-[24px] font-semibold ' + (accent ? 'text-cmgreen-900' : 'text-ink')}>
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
