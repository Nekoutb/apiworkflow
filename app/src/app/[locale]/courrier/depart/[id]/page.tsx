import { Link } from '@/i18n/navigation';
import { redirect, notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import { getStaffScope, assertCanAccessDocument } from '@/lib/visibility';
import type { StaffRole } from '@prisma/client';
import { ComposeResponseForm } from './ComposeResponseForm';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';

export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = ['ADMIN', 'CHEF_BUREAU_DEPART', 'CHEF_SERVICE_COURRIER'];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Metadata' });
  return { title: t('courrierDepartTitle') };
}

export default async function ComposeResponsePage({
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
  const localeShort = locale === 'en' ? 'en' : 'fr';
  const isEn = localeShort === 'en';
  const dtLong: Intl.DateTimeFormatOptions = { dateStyle: 'long', timeStyle: 'short' };
  const dtShort: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };
  const dtLocale = isEn ? 'en-GB' : 'fr-FR';

  const doc = await db.document.findUnique({
    where: { id },
    select: {
      id: true, reference: true, subject: true, nature: true, status: true,
      submittedAt: true, decidedAt: true,
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
    },
  });

  if (!doc) notFound();

  // Block non-DECIDED docs from this composer
  if (doc.status !== 'DECIDED') {
    return (
      <main className="min-h-screen bg-bgsoft">
        <DepartBar role={role} session={session.user} localeShort={localeShort} isEn={isEn} />
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
                ? 'Only documents at status "Decision made" can be composed here. This document is currently at status'
                : 'Seuls les documents au statut « Décision prise » peuvent être composés ici. Ce document est actuellement au statut'}{' '}
              <code className="font-mono">{tStatus(doc.status)}</code>.
            </p>
          </div>
          <Link
            href="/courrier/depart"
            className="mt-6 inline-block border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            {isEn ? '← Back to Outgoing Mail' : '← Retour au Bureau Départ'}
          </Link>
        </section>
      </main>
    );
  }

  const labelEmitter = isEn ? 'Original sender' : "Émetteur d'origine";
  const labelKeyDates = isEn ? 'Key dates' : 'Dates clés';
  const labelVersions = isEn ? `Document versions (${doc.versions.length})` : `Versions du document (${doc.versions.length})`;
  const labelHistory = isEn
    ? `History (${doc.handoffs.length} handoff${doc.handoffs.length > 1 ? 's' : ''})`
    : `Historique (${doc.handoffs.length} handoff${doc.handoffs.length > 1 ? 's' : ''})`;
  const labelNotes = isEn ? `Notes (${doc.comments.length})` : `Notes (${doc.comments.length})`;

  return (
    <main className="min-h-screen bg-bgsoft">
      <DepartBar role={role} session={session.user} localeShort={localeShort} isEn={isEn} />

      <section className="mx-auto max-w-7xl px-7 py-8">
        <Link
          href="/courrier/depart"
          className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
        >
          {isEn ? '← Outgoing Mail' : '← Bureau Départ'}
        </Link>

        <div className="flex items-baseline gap-4">
          <div className="font-mono text-[14px] font-bold text-cmgreen-900">{doc.reference}</div>
          <span className="rounded-sm bg-cmgreen-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmgreen-900">
            {tStatus('DECIDED')} · {isEn ? 'ready to dispatch' : 'prêt à expédier'}
          </span>
        </div>
        <h1 className="serif mt-1 text-[28px] font-semibold tracking-[-0.3px] text-ink">
          {doc.subject}
        </h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          {/* LEFT — context */}
          <div className="space-y-6">
            <Panel title={labelEmitter}>
              <KV k={isEn ? 'Name' : 'Nom'} v={doc.submission?.senderName ?? '—'} />
              <KV k={tCommon('email')} v={doc.submission?.senderEmail ?? '—'} mono />
              {doc.submission?.senderOrganization && (
                <KV k={tCommon('organisation')} v={doc.submission.senderOrganization} />
              )}
              {doc.submission?.senderPhone && (
                <KV k={tCommon('phone')} v={doc.submission.senderPhone} mono />
              )}
              {doc.submission?.senderType && (
                <KV k={isEn ? 'Type' : 'Type'} v={doc.submission.senderType} />
              )}
            </Panel>

            <Panel title={labelKeyDates}>
              <KV k={tCommon('receivedOn')} v={doc.submittedAt.toLocaleString(dtLocale, dtLong)} />
              <KV k={isEn ? 'Decided on' : 'Décidé le'} v={doc.decidedAt?.toLocaleString(dtLocale, dtLong) ?? '—'} />
            </Panel>

            <Panel title={labelVersions}>
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

            <Panel title={labelHistory}>
              {doc.handoffs.length === 0 ? (
                <p className="text-[12.5px] italic text-ink-3">{isEn ? 'No handoff.' : 'Aucun handoff.'}</p>
              ) : (
                <ol className="space-y-3">
                  {doc.handoffs.map((h, i) => (
                    <li key={h.id} className="border-l-2 border-cmgreen-700 pl-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmgreen-900">
                          {i + 1}. {h.type}
                        </div>
                        <div className="text-[10.5px] text-ink-4">
                          {h.createdAt.toLocaleString(dtLocale, dtShort)}
                        </div>
                      </div>
                      <div className="mt-1 text-[11.5px] text-ink-3">
                        {h.fromRole ? roleLabel(h.fromRole, localeShort) : '—'} → {h.toRole ? roleLabel(h.toRole, localeShort) : '—'}
                      </div>
                      {h.reason && (
                        <p className="serif mt-1 text-[12px] italic text-ink-2">{h.reason}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            {doc.comments.length > 0 && (
              <Panel title={labelNotes}>
                <ul className="space-y-3">
                  {doc.comments.map((c) => (
                    <li key={c.id} className="border-l-2 border-gold-600 pl-3">
                      <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
                        <span className="font-bold uppercase tracking-[0.1em] text-gold-700">
                          {c.author?.name ?? c.author?.email ?? (c.authorRole ? roleLabel(c.authorRole, localeShort) : (isEn ? 'System' : 'Système'))}
                        </span>
                        <span className="text-ink-4">
                          {c.createdAt.toLocaleString(dtLocale, dtShort)}
                        </span>
                      </div>
                      <p className="serif mt-1 whitespace-pre-wrap text-[12.5px] text-ink-2">{c.body}</p>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </div>

          {/* RIGHT — the compose form */}
          <div>
            <ComposeResponseForm
              documentId={doc.id}
              defaultRecipientEmail={doc.submission?.senderEmail ?? ''}
              defaultRecipientName={doc.submission?.senderName ?? ''}
              reference={doc.reference}
              originalSubject={doc.subject}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

// ----------------------------------------------------------------------------

function DepartBar({
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
        {isEn ? 'Mail Service' : 'Service du Courrier'} <span className="mx-3 text-gold-500">⚜</span>
        {isEn ? 'Outgoing Mail — Compose' : 'Bureau Départ — Composition'}
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              {isEn ? 'Internal portal · Outgoing Mail' : 'Portail interne · Bureau Départ'}
            </div>
            <div className="serif text-[17px] font-bold text-ink">
              {isEn ? 'Compose the response' : 'Composition de la réponse'}
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
