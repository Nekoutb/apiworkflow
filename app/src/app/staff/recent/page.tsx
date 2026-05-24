import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { sectorLabel, stageLabel, statusLabel, statusPillClass } from '@/lib/stages';
import { formatFcfaCompact } from '@/lib/fcfa';

export const metadata = { title: 'Récemment traités · Workflow d\'agrément' };
export const dynamic = 'force-dynamic';

const ACTIONS_OF_INTEREST = ['SIGNED_OFF', 'HANDED_OFF', 'RECEIPT_ISSUED', 'RETURNED', 'REJECTED'] as const;

export default async function RecentPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=staff');

  const events = await db.workflowEvent.findMany({
    where: { actorUserId: session.user.id, action: { in: [...ACTIONS_OF_INTEREST] } },
    orderBy: { createdAt: 'desc' },
    take: 25,
    include: {
      convention: {
        select: {
          id: true,
          reference: true,
          projectName: true,
          sector: true,
          investmentFcfa: true,
          category: true,
          status: true,
          currentStage: true,
          investor: { select: { raisonSociale: true } },
        },
      },
    },
  });

  return (
    <section className="px-8 py-10">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Historique d&apos;actions
      </div>
      <h1 className="serif text-[34px] font-semibold tracking-[-0.4px] text-ink">
        Récemment traités
      </h1>
      <p className="serif mt-1 text-[13.5px] italic text-ink-3">
        Vos 25 dernières actions sur des dossiers (signatures, transmissions, récépissés, renvois).
      </p>

      {events.length === 0 ? (
        <div className="mt-10 border border-dashed border-line-2 bg-white p-12 text-center">
          <div className="text-[32px] leading-none text-ink-4">📋</div>
          <h2 className="serif mt-3 text-[20px] font-bold text-ink">Aucune action consignée</h2>
          <p className="serif mt-2 text-[13px] italic text-ink-3">
            Vos signatures et transmissions apparaîtront ici dès que vous commencerez à traiter des dossiers.
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line border border-line bg-white">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link
                href={`/staff/conventions/${ev.convention.id}`}
                className="grid grid-cols-[100px_1fr_auto] items-center gap-4 px-5 py-4 transition hover:bg-bgsoft"
              >
                <div className="text-right">
                  <div className="font-mono text-[12px] font-semibold text-ink-2">
                    {ev.createdAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-ink-4">
                    {ev.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] uppercase tracking-[0.14em] text-gold-700">
                    {actionLabel(ev.action)} · {stageLabel(ev.stage)}
                  </div>
                  <div className="serif mt-0.5 text-[14.5px] font-semibold text-ink">
                    {ev.convention.projectName}
                  </div>
                  <div className="mt-0.5 text-[11.5px] italic text-ink-3">
                    {ev.convention.investor.raisonSociale} ·{' '}
                    <span className="font-mono not-italic">{ev.convention.reference}</span> ·{' '}
                    {sectorLabel(ev.convention.sector)} · {formatFcfaCompact(ev.convention.investmentFcfa)}
                  </div>
                  {ev.comment && (
                    <blockquote className="serif mt-1.5 border-l-2 border-line-2 pl-2 text-[12px] italic text-ink-3">
                      « {ev.comment} »
                    </blockquote>
                  )}
                </div>
                <span className={`pill ${statusPillClass(ev.convention.status)}`}>{statusLabel(ev.convention.status)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function actionLabel(action: string): string {
  switch (action) {
    case 'SIGNED_OFF':     return 'Signature';
    case 'HANDED_OFF':     return 'Transmission';
    case 'RECEIPT_ISSUED': return 'Récépissé délivré';
    case 'RETURNED':       return 'Renvoi à l\'investisseur';
    case 'REJECTED':       return 'Rejet';
    case 'RECEIVED':       return 'Réception';
    default:               return action;
  }
}
