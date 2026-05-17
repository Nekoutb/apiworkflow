import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Logo } from '@/components/brand/Logo';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { ArrowRight, FileText, MessageCircle, PlusCircle, Bell } from 'lucide-react';
import { STATE_LABEL_FR, progressForDocuments } from '@/lib/dossier';

export const metadata = { title: 'Mon espace · API Cameroun' };
export const dynamic = 'force-dynamic';

export default async function InvestorDashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? 'Investisseur';

  // Load this investor's dossiers
  const profile = await db.investorProfile.findFirst({
    where: { userId: session?.user?.id ?? '' },
  });
  const dossiers = profile
    ? await db.dossier.findMany({
        where: { investorProfileId: profile.id },
        include: { documents: true },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  // Unread notifications
  const unread = session?.user
    ? await db.notification.count({
        where: { forUserId: session.user.id, read: false },
      })
    : 0;

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-cmgreen-700 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Logo className="h-10 w-10 rounded-lg" />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wider opacity-80">Espace Investisseur</div>
            <div className="text-sm font-semibold">API Cameroun</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/20 hover:bg-black/30" title="Notifications">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-cmgreen-700 bg-cmred px-1 text-[10px] font-bold">
                  {unread}
                </span>
              )}
            </button>
            <LogoutButton />
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-cmgreen-700 via-cmred to-cmyellow" />
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Bienvenue, {name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Préparez et suivez vos demandes d&apos;agrément aux incitations à l&apos;investissement.
            </p>
          </div>
          <Link href="/investor/new" className="btn-primary">
            <PlusCircle className="h-4 w-4" />
            Nouvelle demande
          </Link>
        </div>

        {dossiers.length === 0 ? (
          <div className="card border-l-4 border-l-ink-faint">
            <h3 className="font-semibold">Aucun dossier en cours</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Commencez par créer une nouvelle demande. Les 6 pièces obligatoires
              (Art. 6 de l&apos;Ordonnance n° 2025/002) vous seront demandées au cours du processus.
            </p>
            <Link href="/investor/new" className="btn-primary mt-4 inline-flex">
              <PlusCircle className="h-4 w-4" />
              Démarrer ma première demande
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {dossiers.map((d) => {
              const p = progressForDocuments(d.documents.map((x) => ({ kind: x.kind, verification: x.verification })));
              return (
                <Link
                  key={d.id}
                  href={`/investor/dossier/${d.id}`}
                  className="card group flex flex-wrap items-center gap-6 transition hover:shadow-lift"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cmgreen-50 text-cmgreen-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-base font-semibold">{d.reference}</div>
                      <StateBadge state={d.state} />
                    </div>
                    <div className="mt-0.5 text-sm text-ink-muted line-clamp-1">{d.objet}</div>
                    <div className="mt-1 text-xs text-ink-faint">
                      {STATE_LABEL_FR[d.state]} · Pièces : {p.uploadedDocs}/{p.totalDocs} téléversées
                      {p.acceptedDocs > 0 && ` · ${p.acceptedDocs} acceptées`}
                      {p.rejectedDocs > 0 && ` · ${p.rejectedDocs} rejetées`}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-cmgreen-700 transition group-hover:translate-x-1" />
                </Link>
              );
            })}
          </div>
        )}

        {/* Quick tiles */}
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Link href="/investor/new" className="card group flex items-center gap-4 transition hover:shadow-lift">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cmgreen-50 text-cmgreen-700">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Nouvelle demande</div>
              <div className="text-sm text-ink-muted">Démarrer une demande d&apos;agrément.</div>
            </div>
            <ArrowRight className="h-4 w-4 text-cmgreen-700 transition group-hover:translate-x-1" />
          </Link>
          <div className="card flex items-center gap-4 opacity-70">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-bg-page text-ink-muted">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="font-semibold">Messages {unread > 0 && <span className="text-xs text-cmred">({unread} non lu)</span>}</div>
              <div className="text-sm text-ink-muted">Centre de messages — disponible en Phase 1 W5.</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const cls =
    state === 'DRAFT'      ? 'bg-bg-page text-ink-muted' :
    state === 'SUBMITTED'  ? 'bg-info-bg text-info' :
    state === 'ACCREDITED' ? 'bg-success-bg text-success' :
    state === 'REJECTED'   ? 'bg-danger-bg text-danger' :
                              'bg-warning-bg text-warning';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>{state}</span>;
}
