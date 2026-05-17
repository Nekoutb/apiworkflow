import Link from 'next/link';
import { ArrowLeft, Inbox } from 'lucide-react';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { Logo } from '@/components/brand/Logo';
import { LogoutButton } from '@/components/auth/LogoutButton';
import { STATE_LABEL_FR } from '@/lib/dossier';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Corbeille · API Cameroun' };
export const dynamic = 'force-dynamic';

// Maps each staff role to the dossier state(s) that land in their inbox
const ROLE_INBOX: Record<string, string[]> = {
  RECEPTION:   ['SUBMITTED', 'DOCS_VERIFICATION'],
  INSTRUCTION: ['RECEIPT_ISSUED'],
  TAX:         ['INSTRUCTION_DONE'],
  CUSTOMS:     ['TAX_OPINION_DONE'],
  CHEF_GU:     ['CUSTOMS_OPINION_DONE'],
  DG:          ['SYNTHESIS_DONE'],
};

export default async function StaffInboxPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.userType !== 'STAFF') redirect('/login');
  const role: string = session.user.staffRole ?? 'ADMIN';

  const states = ROLE_INBOX[role] ?? [];
  const dossiers = states.length === 0 ? [] : await db.dossier.findMany({
    where: { state: { in: states as never } },
    include: { investorProfile: true, documents: true },
    orderBy: { submittedAt: 'desc' },
  });

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-cmgreen-700 text-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
          <Logo className="h-10 w-10 rounded-lg" />
          <div className="leading-tight">
            <div className="text-[11px] uppercase tracking-wider opacity-80">Portail interne</div>
            <div className="text-sm font-semibold">Agence de Promotion des Investissements</div>
          </div>
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>
        <div className="h-1 bg-gradient-to-r from-cmgreen-700 via-cmred to-cmyellow" />
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10">
        <Link href="/staff" className="mb-4 inline-flex items-center gap-1.5 text-sm text-cmgreen-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Tableau de bord
        </Link>

        <h1 className="text-2xl font-bold">Ma corbeille — {roleLabel(role)}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Dossiers en attente de votre action.
        </p>

        {states.length === 0 ? (
          <div className="card mt-6 text-center">
            <Inbox className="mx-auto h-10 w-10 text-ink-faint" />
            <h3 className="mt-3 font-semibold">Aucun dossier ne vous est assigné</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Votre rôle ne reçoit pas de dossiers via la corbeille (ou il s&apos;agit d&apos;un rôle d&apos;administration).
            </p>
          </div>
        ) : dossiers.length === 0 ? (
          <div className="card mt-6 text-center">
            <Inbox className="mx-auto h-10 w-10 text-ink-faint" />
            <h3 className="mt-3 font-semibold">Aucun dossier en attente</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Tous les dossiers à votre stade ont été traités. Bon travail.
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-bg-page text-left text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Référence</th>
                  <th className="px-4 py-3 font-semibold">Investisseur</th>
                  <th className="px-4 py-3 font-semibold">Catégorie</th>
                  <th className="px-4 py-3 font-semibold">État</th>
                  <th className="px-4 py-3 font-semibold">Pièces</th>
                  <th className="px-4 py-3 font-semibold">Soumis le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dossiers.map((d) => {
                  const accepted = d.documents.filter((x) => x.verification === 'ACCEPTED').length;
                  const rejected = d.documents.filter((x) => x.verification === 'REJECTED').length;
                  const pending  = d.documents.filter((x) => x.verification === 'PENDING').length;
                  return (
                    <tr key={d.id} className="hover:bg-bg-page">
                      <td className="px-4 py-3 font-mono text-cmgreen-700">{d.reference}</td>
                      <td className="px-4 py-3">{d.investorProfile.raisonSociale}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-cmgreen-50 px-2 py-0.5 text-xs font-semibold text-cmgreen-700">Cat. {d.category}</span>
                      </td>
                      <td className="px-4 py-3 text-xs">{STATE_LABEL_FR[d.state]}</td>
                      <td className="px-4 py-3 text-xs">
                        {d.documents.length}/6
                        {accepted > 0 && <span className="text-success"> · ✓{accepted}</span>}
                        {pending > 0 && <span className="text-warning"> · ⏳{pending}</span>}
                        {rejected > 0 && <span className="text-danger"> · ✕{rejected}</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">{d.submittedAt?.toLocaleDateString('fr-FR') ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-border bg-bg-page px-4 py-3 text-xs text-ink-muted">
              📋 La vérification pièce par pièce et l&apos;émission du récépissé seront disponibles en Phase 1 W5.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function roleLabel(role: string): string {
  const m: Record<string, string> = {
    RECEPTION:   'Réception · Guichet Unique',
    INSTRUCTION: 'Instruction · Service Technique',
    TAX:         'Représentant DGI',
    CUSTOMS:     'Représentant DGD',
    CHEF_GU:     'Chef du Guichet Unique',
    DG:          'Directeur Général',
    COMITE_AUDIT:'Comité d\'audit et de recours',
    UNITE_TECHNIQUE: 'Unité technique',
    AUDITOR:     'Auditeur · lecture seule',
    ADMIN:       'Administrateur système',
  };
  return m[role] ?? role;
}
