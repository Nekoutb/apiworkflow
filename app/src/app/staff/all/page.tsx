import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { formatFcfaCompact } from '@/lib/fcfa';
import { sectorLabel, stageLabel, statusLabel, statusPillClass } from '@/lib/stages';

export const metadata = { title: 'Toutes les conventions · Workflow d\'agrément' };
export const dynamic = 'force-dynamic';

export default async function AllConventionsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=staff');

  const conventions = await db.convention.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      investor: { select: { raisonSociale: true } },
    },
  });

  return (
    <section className="px-8 py-10">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Vue d&apos;ensemble
      </div>
      <h1 className="serif text-[34px] font-semibold tracking-[-0.4px] text-ink">
        Toutes les conventions
      </h1>
      <p className="serif mt-1 text-[13.5px] italic text-ink-3">
        Brouillons, instruction en cours, conventions signées et archivées.
      </p>

      <div className="mt-8 border border-line bg-white">
        <table className="w-full">
          <thead>
            <tr className="bg-bgsoft text-left">
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Référence</th>
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Investisseur · Projet</th>
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Secteur</th>
              <th className="px-4 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Investissement</th>
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Étape</th>
              <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Statut</th>
            </tr>
          </thead>
          <tbody>
            {conventions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13px] italic text-ink-3">
                  Aucune convention enregistrée.
                </td>
              </tr>
            )}
            {conventions.map((cv) => (
              <tr key={cv.id} className="border-t border-line">
                <td className="px-4 py-3.5 font-mono text-[12.5px] text-ink">
                  <Link href={`/staff/conventions/${cv.id}`} className="text-cmgreen-800 hover:underline">
                    {cv.reference}
                  </Link>
                </td>
                <td className="px-4 py-3.5 text-[13px] text-ink-2">
                  <div className="font-semibold text-ink">{cv.investor.raisonSociale}</div>
                  <div className="text-[11.5px] italic text-ink-3">{cv.projectName}</div>
                </td>
                <td className="px-4 py-3.5 text-[12.5px] text-ink-2">{sectorLabel(cv.sector)}</td>
                <td className="px-4 py-3.5 text-right font-mono text-[12.5px] text-ink-2 tabular">
                  {formatFcfaCompact(cv.investmentFcfa)}
                  <div className="text-[10px] uppercase tracking-[0.12em] text-ink-4">Cat. {cv.category}</div>
                </td>
                <td className="px-4 py-3.5 text-[12.5px] text-ink-2">
                  {cv.status === 'SIGNED' || cv.status === 'CLOSED' ? '—' : stageLabel(cv.currentStage)}
                </td>
                <td className="px-4 py-3.5">
                  <span className={`pill ${statusPillClass(cv.status)}`}>{statusLabel(cv.status)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
