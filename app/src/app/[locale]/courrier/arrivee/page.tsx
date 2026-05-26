import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';
import { RegisterForm } from './RegisterForm';

export const metadata = { title: 'Bureau Arrivée · API Cameroun' };
export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = ['ADMIN', 'CHEF_BUREAU_ARRIVEE', 'CHEF_SERVICE_COURRIER'];

const STATUS_LABEL_FR: Record<string, string> = {
  RECEIVED: 'Reçu',
  AWAITING_DG_ANALYSIS: 'Chez DG · attente analyse',
  ASSIGNED: 'Affecté à une unité',
  IN_TREATMENT: 'En traitement',
  AWAITING_EXTERNAL_AVIS: 'Attente avis externe',
  AWAITING_DG_DECISION: 'Attente décision DG',
  DECIDED: 'Décision prise',
  RESPONSE_SENT: 'Réponse envoyée',
  CLOSED: 'Clos',
  AWAITING_FOLLOW_UP: 'Attente complément',
};

const NATURE_SHORT: Record<string, string> = {
  AGREMENT_REQUEST: "Demande d'agrément",
  GENERAL_CORRESPONDENCE: 'Correspondance',
  OFFICIAL_NOTIFICATION: 'Notification',
  PARTNERSHIP_PROPOSAL: 'Partenariat',
  COMPLAINT: 'Réclamation',
  REPORT: 'Rapport',
  OTHER: 'Autre',
};

export default async function CourrierArriveePage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || !ALLOWED.includes(role)) redirect('/dashboard');

  // Recent documents registered by Bureau Arrivée (last 30 days, any status)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [recent, todayCount, weekCount, monthCount] = await Promise.all([
    db.document.findMany({
      where: { submittedAt: { gte: since } },
      orderBy: { submittedAt: 'desc' },
      take: 30,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        status: true,
        sourceChannel: true,
        submittedAt: true,
        currentHolderRole: true,
        submission: { select: { senderName: true, senderEmail: true, senderOrganization: true } },
      },
    }),
    db.document.count({
      where: { submittedAt: { gte: startOfDayUTC() } },
    }),
    db.document.count({
      where: { submittedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    db.document.count({
      where: { submittedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return (
    <main className="min-h-screen bg-bgsoft">
      {/* gov bar */}
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span>
        Service du Courrier <span className="mx-3 text-gold-500">⚜</span>
        Bureau Arrivée
      </div>

      {/* header */}
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
            <div className="serif text-[17px] font-bold text-ink">Bureau Arrivée — Enregistrement</div>
          </div>
          <div className="ml-auto text-right leading-tight">
            <div className="text-[13px] font-semibold text-ink">{session.user.name ?? session.user.email}</div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleLabel(role)}</div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Aujourd'hui" value={todayCount} />
          <Stat label="7 derniers jours" value={weekCount} />
          <Stat label="30 derniers jours" value={monthCount} />
          <Stat label="Référence" value="COURRIER-2026" mono small />
        </div>

        {/* Registration form */}
        <div className="mt-10">
          <h2 className="serif mb-3 text-[22px] font-semibold tracking-[-0.3px] text-ink">
            Enregistrer un nouveau document
          </h2>
          <p className="serif mb-6 text-[13.5px] italic text-ink-3">
            Saisissez les informations de l&apos;émetteur, joignez la pièce numérisée
            et envoyez. La référence officielle est générée automatiquement et l&apos;accusé
            de réception est expédié immédiatement.
          </p>
          <RegisterForm />
        </div>

        {/* Recent documents */}
        <h2 className="serif mb-3 mt-14 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Documents récents (30 derniers jours)
        </h2>
        {recent.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            Aucun document enregistré récemment.
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
                  <Th>Canal</Th>
                  <Th>Statut</Th>
                  <Th>Reçu</Th>
                </tr>
              </thead>
              <tbody>
                {recent.map((d) => (
                  <tr key={d.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">
                      {d.reference}
                    </td>
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
                    <td className="px-4 py-3 text-[10.5px] uppercase tracking-[0.1em] text-ink-3">
                      {channelShort(d.sourceChannel)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block bg-gold-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-gold-700">
                        {STATUS_LABEL_FR[d.status] ?? d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-ink-3">
                      {d.submittedAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
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

function channelShort(c: string): string {
  switch (c) {
    case 'ONLINE': return 'En ligne';
    case 'COURRIER_PHYSICAL': return 'Physique';
    case 'ANTENNE': return 'Antenne';
    default: return c;
  }
}

function Stat({ label, value, mono, small }: { label: string; value: string | number; mono?: boolean; small?: boolean }) {
  return (
    <div className="border border-line bg-white px-4 py-3.5">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-3">{label}</div>
      <div
        className={
          'mt-1 font-semibold text-ink ' +
          (small ? 'text-[14px]' : 'text-[24px]') + ' ' +
          (mono ? 'font-mono tracking-tight' : '')
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
