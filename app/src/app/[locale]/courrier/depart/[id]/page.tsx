import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';
import { ComposeResponseForm } from './ComposeResponseForm';
import { NotificationBell } from '@/components/NotificationBell';
import { AppLogo } from '@/components/AppLogo';

export const metadata = { title: 'Composer la réponse · Bureau Départ · API Cameroun' };
export const dynamic = 'force-dynamic';

const ALLOWED: StaffRole[] = ['ADMIN', 'CHEF_BUREAU_DEPART', 'CHEF_SERVICE_COURRIER'];

export default async function ComposeResponsePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user) redirect('/login');
  if (!role || !ALLOWED.includes(role)) redirect('/dashboard');

  const doc = await db.document.findUnique({
    where: { id },
    select: {
      id: true,
      reference: true,
      subject: true,
      nature: true,
      status: true,
      submittedAt: true,
      decidedAt: true,
      submission: {
        select: {
          senderName: true,
          senderEmail: true,
          senderOrganization: true,
          senderPhone: true,
          senderType: true,
        },
      },
      versions: {
        orderBy: { uploadedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          kind: true,
          fileName: true,
          sizeBytes: true,
          mimeType: true,
          uploadedAt: true,
          storageUri: true,
        },
      },
      handoffs: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          type: true,
          fromRole: true,
          toRole: true,
          reason: true,
          createdAt: true,
        },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          authorRole: true,
          body: true,
          createdAt: true,
          author: { select: { name: true, email: true } },
        },
      },
    },
  });

  if (!doc) notFound();

  // Block non-DECIDED docs from this composer
  if (doc.status !== 'DECIDED') {
    return (
      <main className="min-h-screen bg-bgsoft">
        <DepartBar role={role} session={session.user} />
        <section className="mx-auto max-w-3xl px-7 py-16">
          <div className="border border-cmred bg-cmred-50 px-5 py-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
              Statut incompatible
            </div>
            <h1 className="serif mt-2 text-[22px] font-semibold text-ink">
              {doc.reference} · {doc.status}
            </h1>
            <p className="serif mt-2 text-[13.5px] italic text-ink-3">
              Seuls les documents au statut <strong>DECIDED</strong> peuvent être
              composés ici. Ce document est actuellement au statut{' '}
              <code className="font-mono">{doc.status}</code>.
            </p>
          </div>
          <Link
            href="/courrier/depart"
            className="mt-6 inline-block border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            ← Retour au parapheur Bureau Départ
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bgsoft">
      <DepartBar role={role} session={session.user} />

      <section className="mx-auto max-w-7xl px-7 py-8">
        <Link
          href="/courrier/depart"
          className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
        >
          ← Bureau Départ
        </Link>

        <div className="flex items-baseline gap-4">
          <div className="font-mono text-[14px] font-bold text-cmgreen-900">{doc.reference}</div>
          <span className="rounded-sm bg-cmgreen-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmgreen-900">
            DECIDED · prêt à expédier
          </span>
        </div>
        <h1 className="serif mt-1 text-[28px] font-semibold tracking-[-0.3px] text-ink">
          {doc.subject}
        </h1>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          {/* LEFT — context: emitter, history, attached versions */}
          <div className="space-y-6">
            <Panel title="Émetteur d'origine">
              <KV k="Nom"        v={doc.submission?.senderName ?? '—'} />
              <KV k="Email"      v={doc.submission?.senderEmail ?? '—'} mono />
              {doc.submission?.senderOrganization && (
                <KV k="Organisation" v={doc.submission.senderOrganization} />
              )}
              {doc.submission?.senderPhone && (
                <KV k="Téléphone" v={doc.submission.senderPhone} mono />
              )}
              {doc.submission?.senderType && (
                <KV k="Type" v={doc.submission.senderType} />
              )}
            </Panel>

            <Panel title="Dates clés">
              <KV k="Reçu le"   v={doc.submittedAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} />
              <KV k="Décidé le" v={doc.decidedAt?.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) ?? '—'} />
            </Panel>

            <Panel title={`Versions du document (${doc.versions.length})`}>
              {doc.versions.length === 0 ? (
                <p className="text-[12.5px] italic text-ink-3">Aucune version.</p>
              ) : (
                <ul className="space-y-2">
                  {doc.versions.map((v) => (
                    <li key={v.id} className="border border-line bg-bgsoft px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-gold-700">
                          {v.kind}
                        </span>
                        <span className="text-[10.5px] text-ink-4">
                          {fmtBytes(v.sizeBytes)} · {v.uploadedAt.toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11.5px] text-ink-2" title={v.fileName}>
                        {v.fileName}
                      </div>
                      {v.storageUri.startsWith('local-stub://') && (
                        <div className="mt-0.5 text-[10px] italic text-ink-4">
                          ⓘ Fichier non persisté (BLOB_READ_WRITE_TOKEN absent)
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={`Historique (${doc.handoffs.length} handoff${doc.handoffs.length > 1 ? 's' : ''})`}>
              {doc.handoffs.length === 0 ? (
                <p className="text-[12.5px] italic text-ink-3">Aucun handoff.</p>
              ) : (
                <ol className="space-y-3">
                  {doc.handoffs.map((h, i) => (
                    <li key={h.id} className="border-l-2 border-cmgreen-700 pl-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmgreen-900">
                          {i + 1}. {h.type}
                        </div>
                        <div className="text-[10.5px] text-ink-4">
                          {h.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </div>
                      </div>
                      <div className="mt-1 text-[11.5px] text-ink-3">
                        {h.fromRole ?? '—'} → {h.toRole ?? '—'}
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
              <Panel title={`Notes (${doc.comments.length})`}>
                <ul className="space-y-3">
                  {doc.comments.map((c) => (
                    <li key={c.id} className="border-l-2 border-gold-600 pl-3">
                      <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
                        <span className="font-bold uppercase tracking-[0.1em] text-gold-700">
                          {c.author?.name ?? c.author?.email ?? c.authorRole ?? 'Système'}
                        </span>
                        <span className="text-ink-4">
                          {c.createdAt.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
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
// Shared UI fragments
// ----------------------------------------------------------------------------

function DepartBar({
  role,
  session,
}: {
  role: StaffRole;
  session: { name?: string | null; email?: string | null };
}) {
  return (
    <>
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span>
        Service du Courrier <span className="mx-3 text-gold-500">⚜</span>
        Bureau Départ — Composition
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <AppLogo />
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Portail interne · Bureau Départ
            </div>
            <div className="serif text-[17px] font-bold text-ink">Composition de la réponse</div>
          </div>
          <div className="ml-auto text-right leading-tight">
            <div className="text-[13px] font-semibold text-ink">{session.name ?? session.email}</div>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleLabel(role)}</div>
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

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}
