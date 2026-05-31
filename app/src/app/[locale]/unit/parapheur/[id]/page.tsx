import { Link } from '@/i18n/navigation';
import { redirect, notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel, roleMeta, roleChildren, roleParent, ROLES } from '@/lib/roles';
import { getStaffScope, assertCanAccessDocument } from '@/lib/visibility';
import { coAvisReturnTarget, directorPeers, isDirectorPeer } from '@/lib/co-avis';
import type { StaffRole } from '@prisma/client';
import { UnitActions } from './UnitActions';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';
import { DocTimeline } from '@/components/DocTimeline';

const ALL_STAFF_ROLES: StaffRole[] = ROLES.map((r) => r.role);

export const dynamic = 'force-dynamic';

const FORBIDDEN: StaffRole[] = ['DG', 'DGA'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('unitParapheurTitle') };
}

export default async function UnitDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || FORBIDDEN.includes(role)) redirect('/dashboard');

  const scope = getStaffScope(session);
  if (!scope) redirect('/login');
  await assertCanAccessDocument(id, scope);

  const tCommon = await getTranslations('Common');
  const tStatus = await getTranslations('DocStatus');
  const tNature = await getTranslations('DocNature');
  const localeShort = locale === 'en' ? 'en' : 'fr';
  const isEn = localeShort === 'en';
  const dtLocale = isEn ? 'en-GB' : 'fr-FR';
  const dtLong: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeStyle: 'short' };
  const dtShort: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };

  const doc = await db.document.findUnique({
    where: { id },
    select: {
      id: true, reference: true, subject: true, nature: true, status: true,
      submittedAt: true, dispatchedAt: true, currentHolderRole: true, currentHolderUserId: true,
      submission: {
        select: { senderName: true, senderEmail: true, senderOrganization: true, senderPhone: true, senderType: true },
      },
      versions: {
        orderBy: { uploadedAt: 'desc' }, take: 10,
        select: { id: true, kind: true, fileName: true, sizeBytes: true, mimeType: true, uploadedAt: true, storageUri: true },
      },
      handoffs: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, fromRole: true, toRole: true, reason: true, createdAt: true },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorRole: true, body: true, createdAt: true, author: { select: { name: true, email: true } } },
      },
      assignments: {
        where: role === 'ADMIN' ? { status: 'ACTIVE' } : { status: 'ACTIVE', assignedToRole: role },
        orderBy: { assignedAt: 'desc' }, take: 1,
        select: { id: true, assignedAt: true, assignedToRole: true, instructions: true, assignedBy: { select: { name: true, email: true } } },
      },
      externalTransmissions: {
        orderBy: { sentAt: 'desc' }, take: 10,
        select: {
          id: true, recipient: true, recipientName: true, recipientEmail: true, recipientAddress: true,
          purpose: true, sentAt: true, expectedReturnAt: true, receivedAt: true, opinionSummary: true,
          status: true, sentBy: { select: { name: true, email: true } },
        },
      },
    },
  });
  if (!doc) notFound();

  const myAssignment = doc.assignments[0];

  if (!myAssignment) {
    return (
      <main className="min-h-screen bg-bgsoft">
        <UnitBar role={role} session={session.user} localeShort={localeShort} isEn={isEn} />
        <section className="mx-auto max-w-3xl px-7 py-16">
          <div className="border border-cmred bg-cmred-50 px-5 py-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
              {isEn ? 'No active assignment' : 'Aucune affectation active'}
            </div>
            <h1 className="serif mt-2 text-[22px] font-semibold text-ink">{doc.reference}</h1>
            <p className="serif mt-2 text-[13.5px] italic text-ink-3">
              {isEn ? (
                <>This document is not (or no longer) assigned to your unit — <strong>{roleLabel(role, localeShort)}</strong>. If you believe this is an error, contact the Mail Service or the GM.</>
              ) : (
                <>Ce document n&apos;est pas (ou plus) affecté à votre unité — <strong>{roleLabel(role, localeShort)}</strong>. Si vous pensez qu&apos;il s&apos;agit d&apos;une erreur, contactez le Service du Courrier ou le DG.</>
              )}
            </p>
            <p className="serif mt-2 text-[12px] italic text-ink-4">
              {isEn ? 'Current document status: ' : 'Statut actuel du document : '}<code className="font-mono">{tStatus(doc.status)}</code>
              {doc.currentHolderRole && ` · ${isEn ? 'held by' : 'détenu par'} ${roleLabel(doc.currentHolderRole, localeShort)}`}
            </p>
          </div>
          <Link
            href="/unit/parapheur"
            className="mt-6 inline-block border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            {isEn ? '← Back to my folder' : '← Retour à mon parapheur'}
          </Link>
        </section>
      </main>
    );
  }

  const isWorkable =
    doc.status === 'ASSIGNED' || doc.status === 'IN_TREATMENT' || doc.status === 'AWAITING_EXTERNAL_AVIS';
  const effectiveRoleForActions = role === 'ADMIN' ? myAssignment.assignedToRole : role;

  return (
    <main className="min-h-screen bg-bgsoft">
      <UnitBar role={role} session={session.user} localeShort={localeShort} isEn={isEn} />

      <section className="mx-auto max-w-7xl px-7 py-8">
        <Link
          href="/unit/parapheur"
          className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
        >
          {isEn ? '← My folder' : '← Mon parapheur'}
        </Link>

        <div className="flex flex-wrap items-baseline gap-3">
          <div className="font-mono text-[14px] font-bold text-cmgreen-900">{doc.reference}</div>
          <StatusPill status={doc.status} tStatus={tStatus} isEn={isEn} />
          {role === 'ADMIN' && role !== effectiveRoleForActions && (
            <span className="rounded-sm bg-cmred-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmred">
              {isEn ? `⚠ Admin view · actions act as ${roleLabel(effectiveRoleForActions, localeShort)}` : `⚠ Vue admin · actions agiront comme ${roleLabel(effectiveRoleForActions, localeShort)}`}
            </span>
          )}
        </div>
        <h1 className="serif mt-1 text-[28px] font-semibold tracking-[-0.3px] text-ink">
          {doc.subject}
        </h1>
        <div className="mt-1 text-[12px] text-ink-3">
          {tNature(doc.nature)} · {isEn ? 'received on' : 'reçu le'}{' '}
          {doc.submittedAt.toLocaleString(dtLocale, dtLong)}
          {doc.dispatchedAt && (
            <>
              {' '}· {isEn ? 'dispatched on' : 'dispatché le'}{' '}
              {doc.dispatchedAt.toLocaleString(dtLocale, dtLong)}
            </>
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          {/* LEFT — context */}
          <div className="space-y-6">
            <Panel title={tCommon('sender')}>
              <KV k={isEn ? 'Name' : 'Nom'} v={doc.submission?.senderName ?? '—'} />
              <KV k={tCommon('email')} v={doc.submission?.senderEmail ?? '—'} mono />
              {doc.submission?.senderOrganization && (
                <KV k={tCommon('organisation')} v={doc.submission.senderOrganization} />
              )}
              {doc.submission?.senderPhone && (
                <KV k={tCommon('phone')} v={doc.submission.senderPhone} mono />
              )}
              {doc.submission?.senderType && (
                <KV k="Type" v={doc.submission.senderType} />
              )}
            </Panel>

            <Panel title={isEn ? 'Assignment' : 'Affectation'}>
              <KV k={isEn ? 'Target unit' : 'Unité cible'} v={roleLabel(myAssignment.assignedToRole, localeShort)} />
              <KV k={isEn ? 'Article' : 'Article'} v={roleMeta(myAssignment.assignedToRole)?.article ?? '—'} mono />
              <KV k={isEn ? 'Assigned on' : 'Affecté le'} v={myAssignment.assignedAt.toLocaleString(dtLocale, dtShort)} mono />
              <KV k={isEn ? 'By' : 'Par'} v={myAssignment.assignedBy?.name ?? myAssignment.assignedBy?.email ?? 'DG'} />
              {myAssignment.instructions && (
                <div className="mt-2 border-l-2 border-gold-700 bg-gold-50/40 px-3 py-2 text-[12.5px] italic text-gold-900">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-700">
                    {isEn ? 'GM instructions' : 'Instructions du DG'}
                  </div>
                  <p className="serif mt-1 whitespace-pre-wrap">{myAssignment.instructions}</p>
                </div>
              )}
            </Panel>

            <Panel title={isEn ? `Document versions (${doc.versions.length})` : `Versions du document (${doc.versions.length})`}>
              {doc.versions.length === 0 ? (
                <p className="text-[12.5px] italic text-ink-3">{isEn ? 'No version.' : 'Aucune version.'}</p>
              ) : (
                <ul className="space-y-2">
                  {doc.versions.map((v) => (
                    <li key={v.id} className="border border-line bg-bgsoft px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gold-700">{v.kind}</span>
                        <span className="text-[10.5px] text-ink-4">
                          {fmtBytes(v.sizeBytes, isEn)} · {v.uploadedAt.toLocaleDateString(dtLocale)}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11.5px] text-ink-2" title={v.fileName}>{v.fileName}</div>
                      {v.storageUri.startsWith('local-stub://') && (
                        <div className="mt-0.5 text-[10px] italic text-ink-4">
                          {isEn ? 'ⓘ File not persisted (BLOB_READ_WRITE_TOKEN missing)' : 'ⓘ Fichier non persisté (BLOB_READ_WRITE_TOKEN absent)'}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={isEn ? `History & notes (${doc.handoffs.length + doc.comments.length})` : `Historique & notes (${doc.handoffs.length + doc.comments.length})`}>
              <DocTimeline
                handoffs={doc.handoffs}
                comments={doc.comments}
                locale={localeShort}
                isEn={isEn}
              />
            </Panel>
          </div>

          {/* RIGHT — actions */}
          <div>
            {isWorkable ? (
              <UnitActions
                documentId={doc.id}
                documentReference={doc.reference}
                currentStatus={doc.status}
                effectiveRole={effectiveRoleForActions}
                effectiveRoleLabel={roleLabel(effectiveRoleForActions, localeShort)}
                childrenRoles={roleChildren(effectiveRoleForActions)}
                parentRole={(() => {
                  const p = roleParent(effectiveRoleForActions);
                  if (!p || p === 'DG' || p === 'DGA') return null;
                  return p;
                })()}
                isDirectorLevel={isDirectorPeer(effectiveRoleForActions)}
                peerRoles={directorPeers(effectiveRoleForActions, ALL_STAFF_ROLES)}
                coAvisReturnTarget={coAvisReturnTarget(doc.handoffs, effectiveRoleForActions)}
                externalTransmissions={doc.externalTransmissions.map((t) => ({
                  id: t.id,
                  recipient: t.recipient,
                  recipientName: t.recipientName,
                  recipientEmail: t.recipientEmail,
                  purpose: t.purpose,
                  sentAt: t.sentAt.toISOString(),
                  expectedReturnAt: t.expectedReturnAt?.toISOString() ?? null,
                  receivedAt: t.receivedAt?.toISOString() ?? null,
                  opinionSummary: t.opinionSummary,
                  status: t.status,
                  sentByName: t.sentBy?.name ?? t.sentBy?.email ?? null,
                }))}
              />
            ) : (
              <div className="lg:sticky lg:top-6 lg:self-start">
                <div className="border border-line bg-white p-5">
                  <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-3">
                    {isEn ? 'No action available' : 'Aucune action disponible'}
                  </div>
                  <h3 className="serif text-[15px] font-semibold text-ink">
                    {isEn ? 'Status: ' : 'Statut : '}{tStatus(doc.status)}
                  </h3>
                  <p className="serif mt-2 text-[12.5px] italic text-ink-3">
                    {isEn
                      ? 'Folder actions are only available on documents at status "To pick up" or "In treatment".'
                      : 'Les actions du parapheur ne sont disponibles que sur les documents au statut « À prendre en charge » ou « En traitement ».'}
                  </p>
                  <Link
                    href="/unit/parapheur"
                    className="mt-4 inline-block border border-line-2 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
                  >
                    {isEn ? '← Back' : '← Retour'}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

// ----------------------------------------------------------------------------

function UnitBar({
  role,
  session,
  localeShort,
  isEn,
}: {
  role: StaffRole;
  session: { name?: string | null; email?: string | null };
  localeShort: 'fr' | 'en';
  isEn: boolean;
}) {
  return (
    <>
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        {isEn ? 'Internal portal' : 'Portail interne'} <span className="mx-3 text-gold-500">⚜</span>
        {isEn ? 'Unit' : 'Unité'} <span className="mx-3 text-gold-500">⚜</span>
        {isEn ? 'Assigned document' : 'Document affecté'}
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              {isEn ? 'Internal portal · Unit' : 'Portail interne · Unité'}
            </div>
            <div className="serif text-[17px] font-bold text-ink">
              {isEn ? 'Document assigned to my unit' : 'Document affecté à mon unité'}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">{session.name ?? session.email}</div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleLabel(role, localeShort)}</div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

function StatusPill({
  status,
  tStatus,
  isEn,
}: {
  status: string;
  tStatus: Awaited<ReturnType<typeof getTranslations<'DocStatus'>>>;
  isEn: boolean;
}) {
  const style =
    status === 'IN_TREATMENT'           ? 'bg-cmgreen-50 text-cmgreen-900' :
    status === 'ASSIGNED'               ? 'bg-gold-50 text-gold-700' :
    status === 'AWAITING_EXTERNAL_AVIS' ? 'bg-cmred-50 text-cmred' :
                                          'bg-line/50 text-ink-3';
  const known = ['IN_TREATMENT', 'ASSIGNED', 'AWAITING_EXTERNAL_AVIS', 'RECEIVED', 'AWAITING_DG_ANALYSIS', 'AWAITING_DG_DECISION', 'DECIDED', 'RESPONSE_SENT', 'CLOSED', 'AWAITING_FOLLOW_UP'].includes(status);
  const prefix = status === 'AWAITING_EXTERNAL_AVIS' ? '⏳ ' : '';
  const label = known ? prefix + tStatus(status as Parameters<typeof tStatus>[0]) : status;
  return (
    <span className={'rounded-sm px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] ' + style}>
      {label}
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-line bg-white">
      <div className="border-b border-line bg-bgsoft px-4 py-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-3">
        {title}
      </div>
      <div className="space-y-1.5 p-4 text-[12.5px] text-ink-2">{children}</div>
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-3">{k}</span>
      <span className={'text-right text-ink ' + (mono ? 'font-mono text-[11.5px]' : '')}>{v}</span>
    </div>
  );
}

function fmtBytes(n: number, isEn: boolean): string {
  if (n < 1024) return `${n} ${isEn ? 'B' : 'o'}`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} ${isEn ? 'KB' : 'Ko'}`;
  return `${(n / 1024 / 1024).toFixed(1)} ${isEn ? 'MB' : 'Mo'}`;
}
