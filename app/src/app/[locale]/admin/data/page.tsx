import { Link } from '@/i18n/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('adminDataTitle') };
}

export default async function AdminDataPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('AdminData');
  const tCommon = await getTranslations('Common');
  const tAdmin = await getTranslations('Admin');
  const tDashboard = await getTranslations('Dashboard');
  const tStatus = await getTranslations('DocStatus');
  const tNature = await getTranslations('DocNature');
  const tChannel = await getTranslations('SourceChannel');

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

  // Locale-aware counter labels (using existing/standard nouns).
  const isEn = locale === 'en';
  const counters: { label: string; value: number }[] = [
    { label: isEn ? 'Users'                  : 'Utilisateurs',           value: userCount },
    { label: isEn ? 'Regional offices'       : 'Antennes',               value: antenneCount },
    { label: isEn ? 'Documents'              : 'Documents',              value: documentCount },
    { label: isEn ? 'Submissions'            : 'Submissions',            value: submissionCount },
    { label: isEn ? 'Document versions'      : 'Versions de document',   value: versionCount },
    { label: isEn ? 'Assignments'            : 'Assignations',           value: assignmentCount },
    { label: isEn ? 'Handoffs'               : 'Handoffs',               value: handoffCount },
    { label: isEn ? 'Comments'               : 'Commentaires',           value: commentCount },
    { label: isEn ? 'Attachments'            : 'Pièces jointes',         value: attachmentCount },
    { label: isEn ? 'AI analyses'            : 'Analyses IA',            value: aiAnalysisCount },
    { label: isEn ? 'Notifications'          : 'Notifications',          value: notificationCount },
    { label: isEn ? 'External transmissions' : 'Transmissions externes', value: externalCount },
    { label: isEn ? 'Audit trail'            : 'Audit trail',            value: auditCount },
  ];

  return (
    <section className="mx-auto max-w-7xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        {t('kicker')}
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">{t('title')}</h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">{t('intro')}</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {counters.map((c) => (
          <div key={c.label} className="border border-line bg-white p-5">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-3">
              {c.label}
            </div>
            <div className="serif mt-1 text-[34px] font-bold leading-none tracking-[-0.5px] text-ink">
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <h2 className="serif text-[22px] font-semibold text-ink">
          {isEn ? 'Recent documents' : 'Documents récents'}
        </h2>

        <div className="mt-5 border border-line bg-white">
          <table className="w-full">
            <thead>
              <tr className="bg-bgsoft text-left">
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  {tCommon('reference')}
                </th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  {tCommon('subject')} · {tCommon('sender')}
                </th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  {tCommon('nature')}
                </th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  {tCommon('channel')}
                </th>
                <th className="px-4 py-3 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
                  {tCommon('status')}
                </th>
              </tr>
            </thead>
            <tbody>
              {recentDocs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-[13px] italic text-ink-3">
                    {tCommon('noResults')}
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
                  <td className="px-4 py-3.5 text-[11.5px] text-ink-3">{tNature(d.nature)}</td>
                  <td className="px-4 py-3.5 text-[11.5px] text-ink-3">
                    {tChannel(d.sourceChannel + '_SHORT' as 'ONLINE_SHORT' | 'COURRIER_PHYSICAL_SHORT' | 'ANTENNE_SHORT')}
                    {d.antenne && <div className="text-[10.5px] italic">{d.antenne.name}</div>}
                  </td>
                  <td className="px-4 py-3.5 text-[11.5px] text-ink-2">{tStatus(d.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-10 flex gap-3">
        <Link href="/admin/users" className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink">
          ← {tAdmin('navUsers')}
        </Link>
        <Link href="/dashboard" className="border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink">
          {tDashboard('panelHeading')}
        </Link>
      </div>
    </section>
  );
}
