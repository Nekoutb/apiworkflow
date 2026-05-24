import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatFcfaCompact } from '@/lib/fcfa';
import { sectorLabel, stageLabel, statusLabel, statusPillClass } from '@/lib/stages';
import { roleLabel, isStaffRole } from '@/lib/roles';
import { stageForRole } from '@/lib/staff-corbeille';
import type { StaffRole } from '@prisma/client';

export const metadata = { title: 'Ma corbeille · Workflow d\'agrément' };
export const dynamic = 'force-dynamic';

export default async function StaffInboxPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=staff');
  if (!isStaffRole(session.user.role)) redirect('/');

  const role = session.user.role as StaffRole;
  const stage = stageForRole(role);

  const conventions = await db.convention.findMany({
    where: stage
      ? { status: 'SUBMITTED', currentStage: stage }
      : { status: 'SUBMITTED' },
    orderBy: [{ recepisseAt: 'asc' }, { submittedAt: 'asc' }],
    include: {
      investor: { select: { raisonSociale: true, niu: true } },
      _count: { select: { documents: true, workflowEvents: true } },
    },
  });

  return (
    <section className="px-8 py-10">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ {stage ? `Stage ${stageNumber(stage)} sur 5` : 'Vue administrateur'}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h1 className="serif text-[34px] font-semibold tracking-[-0.4px] text-ink">
            Ma corbeille
          </h1>
          <p className="serif mt-1 text-[13.5px] italic text-ink-3">
            {stage
              ? `Dossiers en attente d'action — ${roleLabel(role)}.`
              : 'Vue d\'ensemble — tous les dossiers en instruction.'}
          </p>
        </div>
        <div className="text-right">
          <div className="serif text-[42px] font-bold leading-none tracking-[-0.5px] text-ink tabular">
            {conventions.length}
          </div>
          <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">
            dossier{conventions.length > 1 ? 's' : ''} en attente
          </div>
        </div>
      </div>

      {conventions.length === 0 ? (
        <EmptyState role={role} />
      ) : (
        <ul className="mt-8 space-y-4">
          {conventions.map((cv) => {
            const slaDaysLeft = cv.recepisseAt ? 10 - businessDaysSince(cv.recepisseAt) : null;
            const awaitingReceipt = stage === 'SECRETARY' && !cv.recepisseAt;

            return (
              <li key={cv.id}>
                <Link
                  href={`/staff/conventions/${cv.id}`}
                  className="group block border border-line bg-white p-5 transition hover:border-cmgreen-700 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="inline-block border border-line-2 bg-bgsoft px-2 py-0.5 font-mono text-[11px] font-bold tracking-tight text-ink-2">
                          {cv.reference}
                        </span>
                        <span className={`pill ${statusPillClass(cv.status)}`}>
                          {awaitingReceipt ? 'Nouveau · à vérifier' : statusLabel(cv.status)}
                        </span>
                        {slaDaysLeft !== null && (
                          <SlaPill daysLeft={slaDaysLeft} />
                        )}
                      </div>
                      <h3 className="serif mt-2 text-[18px] font-bold leading-tight text-ink group-hover:text-cmgreen-800">
                        {cv.projectName}
                      </h3>
                      <div className="mt-1 text-[12.5px] italic text-ink-3">
                        {cv.investor.raisonSociale}
                        {cv.investor.niu && <span className="ml-2 font-mono text-[11px] not-italic text-ink-4">{cv.investor.niu}</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
                        <Meta label="Secteur"     value={sectorLabel(cv.sector)} />
                        <Meta label="Catégorie"   value={cv.category} />
                        <Meta label="Investissement" value={formatFcfaCompact(cv.investmentFcfa)} />
                        <Meta label="Emplois"     value={cv.jobsPlanned.toLocaleString('fr-FR')} />
                        <Meta label="Pièces"      value={`${cv._count.documents}`} />
                      </div>
                      <div className="mt-2 text-[11.5px] text-ink-3">
                        Reçu à votre niveau{' '}
                        {receivedAtLabel(cv, stage)}
                        {' · '}
                        {awaitingReceipt
                          ? 'récépissé à délivrer'
                          : `étape actuelle ${stageLabel(cv.currentStage)}`}
                      </div>
                    </div>
                    <div className="flex-none text-right text-[11.5px] uppercase tracking-[0.12em] text-cmgreen-800 transition group-hover:tracking-[0.14em]">
                      Ouvrir →
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyState({ role }: { role: StaffRole }) {
  const stage = stageForRole(role);
  return (
    <div className="mt-10 border border-dashed border-line-2 bg-white p-12 text-center">
      <div className="text-[32px] leading-none text-ink-4">📭</div>
      <h2 className="serif mt-3 text-[20px] font-bold text-ink">Aucun dossier en attente</h2>
      <p className="serif mt-2 text-[13px] italic text-ink-3">
        {stage
          ? `Quand un dossier arrive à l'étape ${stageLabel(stage)}, il s'affichera ici.`
          : 'Aucun dossier en instruction actuellement.'}
      </p>
      <p className="mt-5 text-[11.5px] italic text-ink-4">
        Activités en aval&nbsp;: les écrans de traitement (vérification, signature, IA) sont livrés
        progressivement&nbsp;: A9 (Secrétariat), A11–A13 (Directeurs), A14 (DG).
      </p>
    </div>
  );
}

function SlaPill({ daysLeft }: { daysLeft: number }) {
  const ok = daysLeft >= 3;
  const warn = daysLeft >= 0 && daysLeft < 3;
  return (
    <span
      className={
        'inline-block border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ' +
        (ok
          ? 'border-cmgreen-700 bg-cmgreen-50 text-cmgreen-800'
          : warn
            ? 'border-gold-600 bg-gold-50 text-gold-700'
            : 'border-cmred bg-cmred-50 text-cmred')
      }
    >
      SLA · {daysLeft >= 0 ? `${daysLeft} j` : `dépassé ${Math.abs(daysLeft)} j`}
    </span>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <span className="uppercase tracking-[0.12em] text-ink-4">{label}</span>{' '}
      <strong className="font-semibold text-ink-2">{value}</strong>
    </span>
  );
}

function receivedAtLabel(cv: { recepisseAt: Date | null; submittedAt: Date | null }, stage: string | null): string {
  // For Secretariat, "reception" is when the investor submitted.
  // For other stages, it's the most recent event arriving at their stage,
  // which we don't have at hand here — use submittedAt as a fallback.
  const ref = stage === 'SECRETARY' ? cv.submittedAt : cv.recepisseAt ?? cv.submittedAt;
  if (!ref) return '—';
  return formatRelative(ref);
}

function formatRelative(d: Date): string {
  const ms = Date.now() - d.getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return `il y a ${Math.max(1, Math.floor(ms / 60_000))} min`;
  if (h < 24) return `il y a ${h} h`;
  const days = Math.floor(h / 24);
  return `il y a ${days} j`;
}

function businessDaysSince(start: Date): number {
  const now = new Date();
  if (now <= start) return 0;
  let days = 0;
  const cur = new Date(start);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

function stageNumber(stage: string): number {
  return ['SECRETARY', 'DIR_INVESTMENTS', 'DIR_COMPLIANCE', 'DIR_EXTERNAL', 'DG'].indexOf(stage) + 1;
}
