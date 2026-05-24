import Link from 'next/link';
import { db } from '@/lib/db';

export const metadata = { title: 'Aperçu base de données v2 · Administration' };
export const dynamic = 'force-dynamic';

export default async function AdminDataPage() {
  const [
    userCount, antenneCount, documentCount, submissionCount, versionCount,
    assignmentCount, handoffCount, commentCount, attachmentCount,
    aiAnalysisCount, notificationCount, externalCount, auditCount, recentDocs,
  ] = await Promise.all([
    db.user.count(),
    db.antenne.count(),
    db.document.count(),
    db.submission.count(),
    db.documentVersion.count(),
    db.assignment.count(),
    db.handoff.count(),
    db.comment.count(),
    db.attachment.count(),
    db.aiAnalysis.count(),
    db.notification.count(),
    db.externalTransmission.count(),
    db.auditTrailEntry.count(),
    db.document.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        submission: { select: { senderName: true, senderOrganization: true } },
        antenne: { select: { name: true } },
        _count: { select: { versions: true, handoffs: true, comments: true } },
      },
    }),
  ]);

  const counts: { label: string; value: number; helper?: string }[] = [
    { label: 'Utilisateurs',                value: userCount,         helper: '5 seed (admin + DG + Arrivée + Départ + Chef Antenne)' },
    { label: 'Antennes',                    value: antenneCount,      helper: 'B23 ajoutera 4 antennes' },
    { label: 'Documents',                   value: documentCount,     helper: '1 document d\'exemple (en attente DG)' },
    { label: 'Submissions',                 value: submissionCount },
    { label: 'Versions de document',        value: versionCount },
    { label: 'Assignations',                value: assignmentCount,   helper: 'Activé en B9' },
    { label: 'Handoffs',                    value: handoffCount,      helper: '1 handoff Courrier → DG' },
    { label: 'Commentaires',                value: commentCount,      helper: 'Activé en B14' },
    { label: 'Pièces jointes',              value: attachmentCount,   helper: 'Activé en B14' },
    { label: 'Analyses IA',                 value: aiAnalysisCount,   helper: 'Activé en B8' },
    { label: 'Notifications',               value: notificationCount, helper: 'Activé en B20' },
    { label: 'Transmissions externes',      value: externalCount,     helper: 'Activé en B14.5 (Min. Finances)' },
    { label: 'Audit trail',                 value: auditCount,        helper: 'Activé en B21' },
  ];

  return (
    <section className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        Administration · v2
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">Aperçu base de données</h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        Schéma v2 document-centrique poussé sur Neon le 24 mai 2026 (re-baseline).
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {counts.map((c) => (
          <div key={c.label} className="border border-line bg-white p-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              {c.label}
            </div>
            <div className="serif mt-1 text-[34px] font-bold leading-none tracking-[-0.5px] text-ink">
              {c.value}
            </div>
            {c.helper && <div className="mt-2 text-[11.5px] italic text-ink-4">{c.helper}</div>}
          </div>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="serif text-[22px] font-semibold text-ink">Documents récents</h2>
        <p className="serif mt-1 text-[13px] italic text-ink-3">
          Tous les documents enregistrés dans le nouveau schéma v2.
        </p>

        <div className="mt-5 border border-line bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-bgsoft text-left">
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Référence</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Sujet · Émetteur</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Nature</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Source</th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {recentDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[13px] italic text-ink-3">
                    Aucun document enregistré pour le moment.
                  </td>
                </tr>
              )}
              {recentDocs.map((d) => (
                <tr key={d.id} className="border-t border-line">
                  <td className="px-4 py-3.5 font-mono text-[11.5px] text-ink-2">{d.reference}</td>
                  <td className="px-4 py-3.5 text-[13px] text-ink-2">
                    <div className="font-semibold text-ink">{d.subject}</div>
                    <div className="text-[11.5px] italic text-ink-3">
                      {d.submission?.senderName ?? '—'}
                      {d.submission?.senderOrganization && <span> · {d.submission.senderOrganization}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-[11.5px] text-ink-3">{d.nature}</td>
                  <td className="px-4 py-3.5 text-[11.5px] text-ink-3">
                    {d.sourceChannel}
                    {d.antenne && <div className="text-[10.5px] italic">{d.antenne.name}</div>}
                  </td>
                  <td className="px-4 py-3.5 text-[11.5px] text-ink-2">{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10 flex gap-3">
        <Link href="/admin/users" className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink">
          ← Gestion du personnel
        </Link>
        <Link href="/dashboard" className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink">
          Tableau de bord
        </Link>
      </div>
    </section>
  );
}
