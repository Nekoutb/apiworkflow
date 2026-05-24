import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const metadata = { title: 'Nouveau dossier · Espace Investisseur' };
export const dynamic = 'force-dynamic';

const REQUIRED_DOCS = [
  { ref: 'art. 6.1',   name: 'Autorisation d\'exercice' },
  { ref: 'art. 6.2.a', name: 'Plan de recrutement camerounais' },
  { ref: 'art. 6.2.a', name: 'Plan de transfert de technologies' },
  { ref: 'art. 6.2.a', name: 'Plan de sous-traitance locale' },
  { ref: 'art. 6.2.b', name: 'Justification du financement' },
  { ref: 'art. 6',     name: 'Étude de faisabilité du projet' },
];

export default async function NewDossierPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
    select: { raisonSociale: true },
  });

  return (
    <section className="mx-auto max-w-6xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        Dossier · Demande d&apos;agrément
      </div>
      <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
        Nouvelle demande d&apos;incitations
      </h1>
      <p className="serif mt-2 text-[14px] italic text-ink-3">
        {investor?.raisonSociale ? `${investor.raisonSociale} — ` : ''}
        téléversez les six pièces requises par l&apos;Ordonnance n° 2025/002, puis soumettez votre dossier au Secrétariat.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* LEFT — document slots (read-only placeholder; upload comes in A5) */}
        <div className="border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line bg-bgsoft px-6 py-3">
            <h2 className="serif text-[17px] font-bold text-ink">Pièces justificatives</h2>
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
              Art. 6 · PDF · 10 Mo max
            </span>
          </div>

          <ul>
            {REQUIRED_DOCS.map((d, i) => (
              <li key={d.name} className="flex items-center gap-4 border-b border-line px-6 py-4 last:border-b-0">
                <div className="flex h-9 w-9 flex-none items-center justify-center border border-line-2 bg-bgsoft font-display text-[14px] font-bold italic text-ink-3">
                  {toRoman(i + 1)}
                </div>
                <div className="flex-1">
                  <div className="text-[14px] font-semibold text-ink">
                    {d.name}{' '}
                    <span className="ml-1 font-mono text-[10.5px] font-normal text-ink-3">{d.ref}</span>
                  </div>
                  <div className="text-[11.5px] italic text-ink-3">Pièce attendue</div>
                </div>
                <button
                  type="button"
                  disabled
                  title="Activé à l'étape A5"
                  className="border border-line-2 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3 opacity-50"
                >
                  Téléverser
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between border-t border-line bg-bgsoft px-6 py-4">
            <div className="text-[12.5px] italic text-ink-3">
              Statut&nbsp;: <strong className="not-italic font-semibold text-ink">aperçu A4 — téléversement réel activé en A5</strong>
            </div>
            <button
              type="button"
              disabled
              className="bg-gold-600 px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] text-obsidian opacity-40"
            >
              Soumettre →
            </button>
          </div>
        </div>

        {/* RIGHT — editorial aside */}
        <aside className="space-y-4">
          <div className="border-l-4 border-gold-600 bg-white p-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-700">
              ⚜ Cadre légal
            </div>
            <h3 className="serif mt-2 text-[16px] font-bold text-ink">Pourquoi ces pièces&nbsp;?</h3>
            <dl className="mt-3 space-y-3 text-[12.5px] text-ink-2">
              <Row label="Art. 6.1">Autorisation d&apos;exercer dans un secteur éligible (Art. 3).</Row>
              <Row label="Art. 6.2.a">Plans de recrutement, sous-traitance et transfert de technologies favorisant l&apos;économie nationale.</Row>
              <Row label="Art. 6.2.b">Démonstration de la capacité financière du porteur de projet.</Row>
            </dl>
          </div>

          <div className="border-l-4 border-gold-500 bg-obsidian p-5 text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-500">
              ⏱ Délai légal
            </div>
            <h3 className="serif mt-2 text-[16px] font-bold text-gold-500">10 jours ouvrés</h3>
            <p className="mt-2 text-[12px] italic text-white/75">
              À compter de la délivrance du récépissé de dépôt par le Secrétariat (Art. 30.3).
            </p>
          </div>

          <Link
            href="/investor"
            className="block border border-line-2 bg-white px-4 py-2.5 text-center text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-2 transition hover:border-ink hover:text-ink"
          >
            ← Mes dossiers
          </Link>
        </aside>
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className="font-mono text-[11px] font-semibold text-gold-700">{label}</dt>
      <dd className="mt-1 italic text-ink-2">{children}</dd>
    </div>
  );
}

function toRoman(n: number): string {
  const map: Record<number, string> = { 1: 'i', 2: 'ii', 3: 'iii', 4: 'iv', 5: 'v', 6: 'vi' };
  return map[n] ?? String(n);
}
