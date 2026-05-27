import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { roleLabel } from '@/lib/roles';
import { isClaudeConfigured } from '@/lib/claude';
import type { StaffRole } from '@prisma/client';
import { DispatchAiPanel } from './DispatchAiPanel';
import { DecisionPanel } from './DecisionPanel';
import { NotificationBell } from '@/components/NotificationBell';

export const metadata = { title: 'Analyse DG · API Cameroun' };
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

export default async function DgDocumentDetailPage({
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
      acknowledgedAt: true,
      submission: {
        select: {
          senderName: true, senderEmail: true, senderOrganization: true,
          senderPhone: true, senderType: true,
        },
      },
      versions: {
        orderBy: { uploadedAt: 'desc' },
        take: 10,
        select: {
          id: true, kind: true, fileName: true, sizeBytes: true,
          mimeType: true, uploadedAt: true, storageUri: true,
        },
      },
      handoffs: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, fromRole: true, toRole: true, reason: true, createdAt: true },
      },
      comments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, authorRole: true, body: true, createdAt: true,
          author: { select: { name: true, email: true } },
        },
      },
      aiAnalyses: {
        where: { kind: 'ASSIGNMENT_SUGGESTION' },
        orderBy: { generatedAt: 'desc' },
        take: 1,
        select: { id: true, summary: true, generatedAt: true, contentJson: true, modelName: true },
      },
    },
  });
  if (!doc) notFound();

  // The DG parapheur page handles two workable states: initial analysis +
  // final decision (B15). All other states (in-treatment by a unit, etc.)
  // belong elsewhere in the workflow.
  if (doc.status !== 'AWAITING_DG_ANALYSIS' && doc.status !== 'AWAITING_DG_DECISION') {
    return (
      <main className="min-h-screen bg-bgsoft">
        <DgBar role={role} session={session.user} />
        <section className="mx-auto max-w-3xl px-7 py-16">
          <div className="border border-cmred bg-cmred-50 px-5 py-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-cmred">
              Statut incompatible
            </div>
            <h1 className="serif mt-2 text-[22px] font-semibold text-ink">
              {doc.reference} · {doc.status}
            </h1>
            <p className="serif mt-2 text-[13.5px] italic text-ink-3">
              Seuls les documents au statut <strong>AWAITING_DG_ANALYSIS</strong> ou
              {' '}<strong>AWAITING_DG_DECISION</strong> apparaissent dans le parapheur DG.
              Ce document est actuellement au statut{' '}
              <code className="font-mono">{doc.status}</code>.
            </p>
          </div>
          <Link
            href="/dg/parapheur"
            className="mt-6 inline-block border border-line-2 bg-white px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 hover:border-ink hover:text-ink"
          >
            ← Retour au parapheur DG
          </Link>
        </section>
      </main>
    );
  }

  const cached = doc.aiAnalyses[0];
  const isDecisionMode = doc.status === 'AWAITING_DG_DECISION';

  // For decision mode, find the most recent RETURN_TO_DG handoff to know
  // who submitted the dossier and when.
  const submittedHandoff = isDecisionMode
    ? [...doc.handoffs]
        .reverse()
        .find((h) => h.type === 'RETURN_TO_DG')
    : null;

  return (
    <main className="min-h-screen bg-bgsoft">
      <DgBar role={role} session={session.user} />

      <section className="mx-auto max-w-7xl px-7 py-8">
        <Link
          href="/dg/parapheur"
          className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3 hover:text-ink"
        >
          ← Parapheur DG
        </Link>

        <div className="flex items-baseline gap-4">
          <div className="font-mono text-[14px] font-bold text-cmgreen-900">{doc.reference}</div>
          {isDecisionMode ? (
            <span className="rounded-sm bg-cmgreen-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmgreen-900">
              ⚖ En attente · décision DG
            </span>
          ) : (
            <span className="rounded-sm bg-gold-50 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-gold-700">
              En attente · analyse DG
            </span>
          )}
        </div>
        <h1 className="serif mt-1 text-[28px] font-semibold tracking-[-0.3px] text-ink">
          {doc.subject}
        </h1>
        <div className="mt-1 text-[12px] text-ink-3">
          {NATURE_SHORT[doc.nature] ?? doc.nature} · reçu le{' '}
          {doc.submittedAt.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          {/* LEFT — context */}
          <div className="space-y-6">
            <Panel title="Émetteur">
              <KV k="Nom"          v={doc.submission?.senderName ?? '—'} />
              <KV k="Email"        v={doc.submission?.senderEmail ?? '—'} mono />
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

          {/* RIGHT — context-aware panel: dispatch or decision */}
          <div>
            {isDecisionMode ? (
              <DecisionPanel
                documentId={doc.id}
                documentReference={doc.reference}
                submittedByLabel={
                  submittedHandoff?.fromRole ? roleLabel(submittedHandoff.fromRole) : null
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
}: {
  role: StaffRole;
  session: { name?: string | null; email?: string | null };
}) {
  return (
    <>
      <div className="bg-obsidian px-7 py-1.5 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
        Portail interne <span className="mx-3 text-gold-500">⚜</span>
        Direction Générale <span className="mx-3 text-gold-500">⚜</span>
        Analyse de document
      </div>
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-7 py-4">
          <Link
            href="/dashboard"
            className="relative flex h-11 w-11 items-center justify-center border border-obsidian bg-obsidian font-display text-lg font-bold tracking-wide text-gold-500"
          >
            A
            <span aria-hidden className="pointer-events-none absolute inset-[3px] border border-gold-500/45" />
          </Link>
          <div className="leading-tight">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
              Portail interne · Direction Générale
            </div>
            <div className="serif text-[17px] font-bold text-ink">Analyse & Suggestion de dispatch</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <div className="text-right leading-tight">
              <div className="text-[13px] font-semibold text-ink">{session.name ?? session.email}</div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-ink-3">{roleLabel(role)}</div>
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

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}
