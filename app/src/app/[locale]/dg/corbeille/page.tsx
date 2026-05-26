import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';

export const metadata = { title: 'Corbeille DG · API Cameroun' };
export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = ['DG', 'DGA', 'ADMIN'];

const NATURE_SHORT: Record<string, string> = {
  AGREMENT_REQUEST: "Demande d'agrément",
  GENERAL_CORRESPONDENCE: 'Correspondance',
  OFFICIAL_NOTIFICATION: 'Notification',
  PARTNERSHIP_PROPOSAL: 'Partenariat',
  COMPLAINT: 'Réclamation',
  REPORT: 'Rapport',
  OTHER: 'Autre',
};

export default async function DgCorbeillePage() {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || !ALLOWED.includes(role)) redirect('/dashboard');

  const [pending, processedToday, oldestWaiting, totalProcessed] = await Promise.all([
    db.document.findMany({
      where: { status: 'AWAITING_DG_ANALYSIS' },
      orderBy: { submittedAt: 'asc' }, // FIFO
      take: 100,
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        submittedAt: true,
        submission: {
          select: { senderName: true, senderEmail: true, senderOrganization: true, senderType: true },
        },
        aiAnalyses: {
          where: { kind: 'ASSIGNMENT_SUGGESTION' },
          orderBy: { generatedAt: 'desc' },
          take: 1,
          select: { id: true, summary: true, generatedAt: true, contentJson: true },
        },
      },
    }),
    db.document.count({
      where: {
        OR: [
          { dispatchedAt: { gte: startOfDayUTC() } },
          { status: { in: ['ASSIGNED', 'IN_TREATMENT', 'DECIDED', 'RESPONSE_SENT', 'CLOSED'] } },
        ],
        dispatchedAt: { gte: startOfDayUTC() },
      },
    }),
    db.document.findFirst({
      where: { status: 'AWAITING_DG_ANALYSIS' },
      orderBy: { submittedAt: 'asc' },
      select: { submittedAt: true },
    }),
    db.document.count({
      where: { status: { not: 'AWAITING_DG_ANALYSIS' } },
    }),
  ]);

  const oldestAgeMs = oldestWaiting ? Date.now() - oldestWaiting.submittedAt.getTime() : 0;

  return (
    <main className="min-h-screen bg-bgsoft">
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span>
        Direction Générale <span className="mx-3 text-gold-500">⚜</span>
        Corbeille
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
              Portail interne · Direction Générale
            </div>
            <div className="serif text-[17px] font-bold text-ink">
              Corbeille DG — Analyse & Dispatch
            </div>
          </div>
          <div className="ml-auto text-right leading-tight">
            <div className="text-[13px] font-semibold text-ink">
              {session.user.name ?? session.user.email}
            </div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
              {roleLabel(role)}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-7 py-10">
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="En attente d'analyse" value={pending.length} accent />
          <Stat label="Dispatchés aujourd'hui" value={processedToday} />
          <Stat label="Doyen en file" value={oldestWaiting ? humanAge(oldestAgeMs) : '—'} mono />
          <Stat label="Total traités" value={totalProcessed} />
        </div>

        <h2 className="serif mb-3 mt-12 text-[22px] font-semibold tracking-[-0.3px] text-ink">
          Documents en attente d&apos;analyse
        </h2>
        <p className="serif mb-4 text-[12.5px] italic text-ink-3">
          Documents transmis par le Service du Courrier · Bureau Arrivée, triés du plus ancien au
          plus récent. Cliquez sur un document pour ouvrir l&apos;analyse IA + dispatcher.
        </p>

        {pending.length === 0 ? (
          <div className="border border-line bg-white px-5 py-10 text-center text-[12.5px] italic text-ink-3">
            Aucun document en attente. La corbeille se remplit dès qu&apos;un courrier est enregistré
            au Bureau Arrivée.
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
                  <Th>IA</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {pending.map((d) => {
                  const ageMs = Date.now() - d.submittedAt.getTime();
                  const ageClass =
                    ageMs > 7 * 24 * 60 * 60 * 1000 ? 'text-cmred' :
                    ageMs > 3 * 24 * 60 * 60 * 1000 ? 'text-gold-700' :
                    'text-ink-3';
                  const cached = d.aiAnalyses[0];
                  const suggestion = cached?.contentJson as { suggestedRole?: string } | undefined;
                  return (
                    <tr key={d.id} className="border-t border-line align-top">
                      <td className={'px-4 py-3 font-mono text-[11px] font-semibold ' + ageClass}>
                        {humanAge(ageMs)}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] font-semibold text-cmgreen-900">
                        {d.reference}
                      </td>
                      <td className="px-4 py-3 text-[12.5px]">
                        <div className="font-semibold text-ink">{d.submission?.senderName ?? '—'}</div>
                        <div className="text-[11px] text-ink-3">{d.submission?.senderEmail}</div>
                        {d.submission?.senderOrganization && (
                          <div className="text-[10.5px] italic text-ink-4">
                            {d.submission.senderOrganization}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-ink-2">
                        <div className="max-w-md truncate" title={d.subject}>{d.subject}</div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-ink-3">
                        {NATURE_SHORT[d.nature] ?? d.nature}
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        {cached ? (
                          <span
                            className="inline-block bg-cmgreen-50 px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-cmgreen-900"
                            title={`Analyse en cache → ${suggestion?.suggestedRole ?? '—'}`}
                          >
                            ✨ Analysé
                          </span>
                        ) : (
                          <span className="text-ink-4">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dg/corbeille/${d.id}`}
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

function startOfDayUTC(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function humanAge(ms: number): string {
  const min = Math.floor(ms / 60_000);
  if (min < 60)          return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24)            return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30)            return `${d} j`;
  const mo = Math.floor(d / 30);
  return `${mo} mois`;
}

function Stat({ label, value, accent, mono }: { label: string; value: number | string; accent?: boolean; mono?: boolean }) {
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
