import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { isBlobConfigured } from '@/lib/blob-storage';
import { REQUIRED_DOCS } from '@/lib/required-documents';
import { formatFcfaCompact } from '@/lib/fcfa';
import { sectorLabel } from '@/lib/stages';
import { UploadDocSlot, type SlotDocument } from './UploadDocSlot';
import { SubmitDossierForm } from './SubmitDossierForm';

export const metadata = { title: 'Édition du dossier · Espace Investisseur' };
export const dynamic = 'force-dynamic';

export default async function EditConventionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?type=investor');

  const { id } = await params;

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
    select: { id: true, raisonSociale: true },
  });
  if (!investor) redirect('/investor');

  const cv = await db.convention.findUnique({
    where: { id },
    include: {
      documents: {
        select: {
          id: true,
          kind: true,
          fileName: true,
          sizeBytes: true,
          uploadedAt: true,
          verification: true,
          rejectionReason: true,
          storageUri: true,
        },
      },
    },
  });
  if (!cv || cv.investorId !== investor.id) notFound();

  // If already submitted, kick the user back to the dashboard.
  if (cv.status !== 'DRAFT' && cv.status !== 'RETURNED') {
    redirect('/investor');
  }

  const docByKind = new Map<string, SlotDocument>();
  for (const d of cv.documents) {
    docByKind.set(d.kind, {
      id: d.id,
      fileName: d.fileName,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt.toISOString(),
      verification: d.verification,
      rejectionReason: d.rejectionReason,
      stub: d.storageUri.startsWith('local-stub://'),
    });
  }

  const uploadedCount = REQUIRED_DOCS.filter((s) => docByKind.has(s.kind)).length;
  const missingCount = REQUIRED_DOCS.length - uploadedCount;
  const ready = missingCount === 0;
  const blobOk = isBlobConfigured();

  return (
    <section className="mx-auto max-w-6xl px-7 py-12">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.24em] text-gold-700">
        ⚜ Dossier · {cv.reference}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="serif text-4xl font-semibold tracking-[-0.5px] text-ink">
            {cv.projectName}
          </h1>
          <p className="serif mt-2 text-[14px] italic text-ink-3">
            {investor.raisonSociale} · {sectorLabel(cv.sector)} · Catégorie {cv.category} ·{' '}
            {formatFcfaCompact(cv.investmentFcfa)}
          </p>
        </div>
        <span className="border border-line-2 bg-white px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-2">
          {uploadedCount} / {REQUIRED_DOCS.length} pièces
        </span>
      </div>

      {!blobOk && (
        <div className="mt-6 flex items-start gap-3 border-l-4 border-gold-600 bg-gold-50/60 px-4 py-3">
          <span className="text-[18px] leading-none">⚠</span>
          <div className="text-[12.5px] leading-relaxed text-ink-2">
            <strong className="block text-[11px] font-bold uppercase tracking-[0.14em] text-gold-700">
              Stockage de fichiers non configuré
            </strong>
            Les métadonnées (nom, taille, type) sont enregistrées, mais les fichiers ne sont pas
            conservés. Pour activer Vercel Blob, ajoutez la variable{' '}
            <code className="font-mono">BLOB_READ_WRITE_TOKEN</code> dans les réglages du projet
            Vercel (Storage → Create Blob store → Connect).
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* LEFT — 6 upload slots */}
        <div className="border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line bg-bgsoft px-6 py-3">
            <h2 className="serif text-[17px] font-bold text-ink">Pièces justificatives</h2>
            <span className="text-[11px] uppercase tracking-[0.14em] text-ink-3">
              Art. 6 · PDF · 10 Mo max
            </span>
          </div>

          <ul>
            {REQUIRED_DOCS.map((slot, i) => (
              <UploadDocSlot
                key={slot.kind}
                index={i + 1}
                slot={slot}
                conventionId={cv.id}
                document={docByKind.get(slot.kind) ?? null}
                blobConfigured={blobOk}
              />
            ))}
          </ul>

          <SubmitDossierForm
            conventionId={cv.id}
            ready={ready}
            missingCount={missingCount}
          />
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
              <Row label="Art. 6.2.b">Démonstration de la capacité financière du porteur.</Row>
            </dl>
          </div>

          <div className="border-l-4 border-gold-500 bg-obsidian p-5 text-white">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-500">
              ⏱ Délai légal d&apos;instruction
            </div>
            <h3 className="serif mt-2 text-[16px] font-bold text-gold-500">10 jours ouvrés</h3>
            <p className="mt-2 text-[12px] italic text-white/75">
              Après soumission, le Secrétariat vérifie la conformité de votre dossier puis vous
              délivre un récépissé de dépôt par email. <strong className="not-italic font-semibold text-gold-500">Le délai
              de 10 jours court à compter de ce récépissé</strong> (Art. 30.3 de l&apos;Ordonnance
              n° 2025/002), pas à compter de la soumission.
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
