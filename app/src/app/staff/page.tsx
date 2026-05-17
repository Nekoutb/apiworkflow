import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { Inbox, Folder, FilePlus, Activity, Gavel, Scale, Bell } from 'lucide-react';
import { auth } from '@/lib/auth';

export const metadata = { title: 'Portail interne · API Cameroun' };

const STAGES = [
  { id: 'reception',   label: 'Réception',     long: 'Guichet Unique',           count: 0 },
  { id: 'instruction', label: 'Instruction',   long: 'Service Technique',        count: 0 },
  { id: 'tax',         label: 'Avis fiscal',   long: 'DGI',                      count: 0 },
  { id: 'customs',     label: 'Avis douanier', long: 'DGD',                      count: 0 },
  { id: 'chef_gu',     label: 'Synthèse',      long: 'Chef Guichet Unique',      count: 0 },
  { id: 'dg',          label: 'Signature',     long: 'Directeur Général',        count: 0 },
];

export default async function StaffDashboardPage() {
  const session = await auth();
  const name = session?.user?.name ?? 'Utilisateur';
  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-cmgreen-700 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Logo className="h-10 w-10 rounded-lg" />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wider opacity-80">Portail interne</div>
            <div className="text-sm font-semibold">Agence de Promotion des Investissements</div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/20 hover:bg-black/30">
              <Bell className="h-4 w-4" />
            </button>
            <LogoutButton />
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-cmgreen-700 via-cmred to-cmyellow" />
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Tableau de bord — {name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              Vue d&apos;ensemble des dossiers d&apos;agrément en instruction.
            </p>
          </div>
          <Link href="/staff/dossiers/new" className="btn-primary">
            <FilePlus className="h-4 w-4" />
            Nouveau dossier
          </Link>
        </div>

        {/* KPI row */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Kpi label="Dossiers totaux" value="0" hint="Année 2026" />
          <Kpi label="En traitement" value="0" hint="Hors agréés / rejetés" tone="amber" />
          <Kpi label="Convention signée" value="0" hint="Cette année" tone="green" />
          <Kpi label="SLA à risque" value="0" hint="Amber / red" tone="red" />
        </div>

        {/* 6-stage funnel */}
        <div className="card mt-8">
          <h2 className="text-base font-semibold">Workflow d&apos;agrément — répartition par étape</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Articles 29–31 de l&apos;Ordonnance n° 2025/002. Délai légal d&apos;instruction : 10 jours
            ouvrés à compter du récépissé de dépôt (Art. 30.3).
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-6">
            {STAGES.map((s, i) => (
              <div key={s.id} className="rounded-lg border border-border bg-bg-page p-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cmgreen-50 text-xs font-bold text-cmgreen-700">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                <div className="mt-2 text-xs text-ink-muted">{s.long}</div>
                <div className="mt-3 text-2xl font-bold">{s.count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick nav */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <QuickLink href="/staff/inbox" icon={<Inbox className="h-5 w-5" />} title="Ma corbeille">
            Dossiers en attente de votre action
          </QuickLink>
          <QuickLink href="/staff/dossiers" icon={<Folder className="h-5 w-5" />} title="Tous les dossiers">
            Registre complet
          </QuickLink>
          <QuickLink href="/staff/audit" icon={<Scale className="h-5 w-5" />} title="Comité d'audit & recours">
            Sessions, recours, sanctions
          </QuickLink>
          <QuickLink href="/staff/reports" icon={<Activity className="h-5 w-5" />} title="Rapports & analytics">
            Performance SLA, mix sectoriel
          </QuickLink>
          <QuickLink href="/staff/admin" icon={<Gavel className="h-5 w-5" />} title="Référentiel">
            Secteurs, ZDP, utilisateurs
          </QuickLink>
        </div>

        <div className="mt-10 rounded-lg border border-dashed border-border-strong bg-bg-page p-5 text-sm text-ink-muted">
          <strong>Phase 0 scaffold.</strong> This is the staff-portal landing. Phase 1 will
          implement: role-based session, the inbox, the dossier detail view with 6-stage
          state machine, Avis flow with mandatory tax + customs gate (Art. 30.5), and the
          DG signature path with acte d&apos;agrément PDF generation.
        </div>
      </main>
    </div>
  );
}

function Kpi({ label, value, hint, tone = 'blue' }: { label: string; value: string; hint?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const colors = {
    blue:  'border-info bg-info-bg text-info',
    green: 'border-success bg-success-bg text-success',
    amber: 'border-warning bg-warning-bg text-warning',
    red:   'border-danger bg-danger-bg text-danger',
  }[tone];
  return (
    <div className={`rounded-lg border-l-4 bg-surface p-4 shadow-soft ${colors}`}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {hint ? <div className="text-xs text-ink-muted">{hint}</div> : null}
    </div>
  );
}

function QuickLink({ href, icon, title, children }: { href: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
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
