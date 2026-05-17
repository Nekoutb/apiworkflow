import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { LogOut, FileText, MessageCircle, Activity, Bell } from 'lucide-react';

export const metadata = { title: 'Mon espace · API Cameroun' };

export default function InvestorDashboardPage() {
  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="border-b border-border bg-cmgreen-700 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Logo className="h-10 w-10 rounded-lg" />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wider opacity-80">Espace Investisseur</div>
            <div className="text-sm font-semibold">API Cameroun</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/20 hover:bg-black/30">
              <Bell className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-cmgreen-700 bg-cmred px-1 text-[10px] font-bold">
                2
              </span>
            </button>
            <Link href="/" className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-white/10">
              <LogOut className="h-4 w-4" />
              Déconnexion
            </Link>
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-cmgreen-700 via-cmred to-cmyellow" />
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Mon espace</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Préparez et suivez votre demande d&apos;agrément aux incitations à l&apos;investissement.
          </p>
        </div>

        {/* Stub status banner — replaced in Phase 1 with real dossier data */}
        <div className="card mb-6 border-l-4 border-l-ink-faint">
          <h3 className="font-semibold">Aucun dossier en cours</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Commencez par créer une nouvelle demande. Les 6 pièces obligatoires
            (Art. 6 de l&apos;Ordonnance) vous seront demandées au cours du processus.
          </p>
          <Link href="/investor/new" className="btn-primary mt-4 inline-flex">
            + Nouvelle demande
          </Link>
        </div>

        {/* Stub tiles */}
        <div className="grid gap-4 md:grid-cols-3">
          <TileLink href="/investor/documents" icon={<FileText className="h-5 w-5" />} title="Pièces à fournir">
            6 documents obligatoires
          </TileLink>
          <TileLink href="/investor/status" icon={<Activity className="h-5 w-5" />} title="Suivi du dossier">
            Aucun dossier en cours
          </TileLink>
          <TileLink href="/investor/messages" icon={<MessageCircle className="h-5 w-5" />} title="Messages">
            2 nouveaux messages
          </TileLink>
        </div>

        <PhasePlaceholder />
      </main>
    </div>
  );
}

function TileLink({ href, icon, title, children }: { href: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="card flex flex-col gap-3 transition hover:shadow-lift">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cmgreen-50 text-cmgreen-700">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">{children}</p>
      </div>
    </Link>
  );
}

function PhasePlaceholder() {
  return (
    <div className="mt-10 rounded-lg border border-dashed border-border-strong bg-bg-page p-5 text-sm text-ink-muted">
      <strong>Phase 0 scaffold.</strong> This page is the investor-portal landing.
      Phase 1 will populate it with: real auth, the new-request wizard, document upload
      against the 6 mandatory pieces (Art. 6), the SLA-aware status tracker, and the
      messaging panel.
    </div>
  );
}
