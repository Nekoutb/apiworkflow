import { Link } from '@/i18n/navigation';
import { redirect, notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import { getStaffScope, assertCanAccessDocument } from '@/lib/visibility';
import { isClaudeConfigured } from '@/lib/claude';
import type { StaffRole } from '@prisma/client';
import { DispatchAiPanel } from './DispatchAiPanel';
import { DecisionPanel } from './DecisionPanel';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';
import { DocTimeline } from '@/components/DocTimeline';

export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = ['DG', 'DGA', 'ADMIN'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('dgParapheurTitle') };
}

export default async function DgDocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || !ALLOWED.includes(role)) redirect('/dashboard');

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
      submittedAt: true, acknowledgedAt: true,
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
      aiAnalyses: {
        where: { kind: 'ASSIGNMENT_SUGGESTION' },
        orderBy: { generatedAt: 'desc' }, take: 1,
        select: { id: true, summary: true, generatedAt: true, contentJson: true, modelName: true },
      },
    },
  });
  if (!doc) notFound();

  if (doc.status !== 'AWAITING_DG_ANALYSIS' && doc.status !== 'AWAITING_DG_DECISION') {
    return (
      <main className="min-h-screen bg-bgsoft">
        <DgBar role={role} session={session.user} localeShort={localeShort} isEn={isEn} />
        <section className="mx-auto max-w-3xl px-7 py-16">
          <div className="border border-cmred bg-cmred-50 px-5 py-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
              {isEn ? 'Incompatible status' : 'Statut incompatible'}
            </div>
            <h1 className="serif mt-2 text-[22px] font-semibold text-ink">
              {doc.reference} · {tStatus(doc.status)}
            </h1>
            <p className="serif mt-2 text-[13.5px] italic text-ink-3">
              {isEn
                ? 'Only documents at status "GM analysis" or "GM decision" appear in the GM folder. This document is currently at status'
                : 'Seuls les documents au statut « Analyse DG » ou « Décision DG » apparaissent dans le parapheur DG. Ce document est actuellement au statut'}{' '}
              <code className="font-mono">{tStatus(doc.status)}</code>.
            </p>
          </div>
          <Link
            href="/dg/parapheur"
            className="mt-6 inline-block border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            {isEn ? '← Back to GM folder' : '← Retour au parapheur DG'}
          </Link>
        </section>
      </main>
    );
  }

  const cached = doc.aiAnalyses[0];
  const isDecisionMode = doc.status === 'AWAITING_DG_DECISION';
  const submittedHandoff = isDecisionMode
    ? [...doc.handoffs].reverse().find((h) => h.type === 'RETURN_TO_DG')
    : null;

  return (
    <main className="min-h-screen bg-bgsoft">
      <DgBar role={role} session={session.user} localeShort={localeShort} isEn={isEn} />

      <section className="mx-auto max-w-7xl px-7 py-8">
        <Link
          href="/dg/parapheur"
          className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
        >
          {isEn ? '← GM folder' : '← Parapheur DG'}
        </Link>

        <div className="flex items-baseline gap-4">
          <div className="font-mono text-[14px] font-bold text-cmgreen-900">{doc.reference}</div>
          {isDecisionMode ? (
            <span className="rounded-sm bg-cmgreen-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmgreen-900">
              {isEn ? '⚖ Pending · GM decision' : '⚖ En attente · décision DG'}
            </span>
          ) : (
            <span className="rounded-sm bg-gold-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-gold-700">
              {isEn ? 'Pending · GM analysis' : 'En attente · analyse DG'}
            </span>
          )}
        </div>
        <h1 className="serif mt-1 text-[28px] font-semibold tracking-[-0.3px] text-ink">
          {doc.subject}
        </h1>
        <div className="mt-1 text-[12px] text-ink-3">
          {tNature(doc.nature)} · {isEn ? 'received on' : 'reçu le'}{' '}
          {doc.submittedAt.toLocaleString(dtLocale, dtLong)}
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

            <Panel title={isEn ? `Document versions (${doc.versions.length})` : `Versions du document (${doc.versions.length})`}>
              {doc.versions.length === 0 ? (
                <p className="text-[12.5px] italic text-ink-3">{isEn ? 'No version.' : 'Aucune version.'}</p>
              ) : (
                <ul className="space-y-2">
                  {doc.versions.map((v) => (
                    <li key={v.id} className="border border-line bg-bgsoft px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gold-700">
                          {v.kind}
                        </span>
                        <span className="text-[10.5px] text-ink-4">
                          {fmtBytes(v.sizeBytes, isEn)} · {v.uploadedAt.toLocaleDateString(dtLocale)}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11.5px] text-ink-2" title={v.fileName}>
                        {v.fileName}
                      </div>
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

          {/* RIGHT — context-aware panel */}
          <div>
            {isDecisionMode ? (
              <DecisionPanel
                documentId={doc.id}
                documentReference={doc.reference}
                submittedByLabel={
                  submittedHandoff?.fromRole ? roleLabel(submittedHandoff.fromRole, localeShort) : null
                }
                submittedAt={submittedHandoff?.createdAt?.toISOString() ?? null}
              />
            ) : (
              <DispatchAiPanel
                documentId={doc.id}
                aiEnabled={isClaudeConfigured()}
                cached={
                  cached
                    ? {
                        summary: cached.summary,
                        data: cached.contentJson as Record<string, unknown>,
                        generatedAt: cached.generatedAt,
                        modelName: cached.modelName,
                      }
                    : null
                }
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

// ----------------------------------------------------------------------------

function DgBar({
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
        {isEn ? 'General Management' : 'Direction Générale'} <span className="mx-3 text-gold-500">⚜</span>
        {isEn ? 'Document analysis' : 'Analyse de document'}
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              {isEn ? 'Internal portal · General Management' : 'Portail interne · Direction Générale'}
            </div>
            <div className="serif text-[17px] font-bold text-ink">
              {isEn ? 'Analysis & dispatch suggestion' : 'Analyse & Suggestion de dispatch'}
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
