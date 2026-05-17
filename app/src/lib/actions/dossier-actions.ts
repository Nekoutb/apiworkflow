'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  DocumentKind,
  DossierState,
  ProjectType,
  Regime,
  Sector,
  UserType,
  VerificationState,
} from '@prisma/client';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { categoryFor, MANDATORY_DOCS, nextDossierReference } from '@/lib/dossier';
import { getStorage } from '@/lib/storage';

// =====================================================================
// CREATE DOSSIER (called from the new-request wizard's first step)
// =====================================================================

const createSchema = z.object({
  sector: z.nativeEnum(Sector),
  projectType: z.nativeEnum(ProjectType),
  amountFcfa: z.coerce.bigint().positive('Le montant doit être positif'),
  installationMonths: z.coerce.number().int().min(1).max(120).default(60),
  isZdp: z.coerce.boolean().optional(),
  zdpLocality: z.string().optional(),
  objet: z.string().min(20, "Veuillez décrire l'objet du projet (min. 20 caractères)"),
});

export type CreateDossierState = {
  errors?: Record<string, string[]>;
  formError?: string;
  ok?: { dossierId: string; reference: string };
};

export async function createDossierAction(
  _prev: CreateDossierState,
  formData: FormData,
): Promise<CreateDossierState> {
  const session = await auth();
  if (!session?.user) return { formError: 'Session expirée.' };
  if (session.user.userType !== UserType.INVESTOR) {
    return { formError: 'Seuls les investisseurs peuvent créer un dossier.' };
  }

  const profile = await db.investorProfile.findFirst({
    where: { userId: session.user.id ?? '' },
  });
  if (!profile) return { formError: "Profil investisseur introuvable." };

  const raw = Object.fromEntries(formData.entries());
  const parsed = createSchema.safeParse({
    ...raw,
    isZdp: raw.isZdp === 'on' || raw.isZdp === 'true',
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;

  const reference = await nextDossierReference();
  const dossier = await db.dossier.create({
    data: {
      reference,
      investorProfileId: profile.id,
      regime: Regime.COMMUN,
      projectType: d.projectType,
      sector: d.sector,
      isZdp: !!d.isZdp,
      zdpLocality: d.zdpLocality || null,
      objet: d.objet,
      installationMonths: d.installationMonths,
      amountFcfa: d.amountFcfa,
      category: categoryFor(d.amountFcfa),
      state: DossierState.DRAFT,
      history: {
        create: {
          actorUserId: session.user.id ?? null,
          action: `Dossier ${reference} créé en brouillon`,
        },
      },
    },
  });

  return { ok: { dossierId: dossier.id, reference: dossier.reference } };
}

// =====================================================================
// UPLOAD DOCUMENT (called from the upload form on the wizard's step 2)
// =====================================================================

const uploadSchema = z.object({
  dossierId: z.string().min(1),
  kind: z.nativeEnum(DocumentKind),
});

export type UploadDocState = {
  errors?: Record<string, string[]>;
  formError?: string;
  ok?: { kind: DocumentKind };
};

export async function uploadDocAction(
  _prev: UploadDocState,
  formData: FormData,
): Promise<UploadDocState> {
  const session = await auth();
  if (!session?.user) return { formError: 'Session expirée.' };

  const rawText = {
    dossierId: String(formData.get('dossierId') ?? ''),
    kind: String(formData.get('kind') ?? '') as DocumentKind,
  };
  const parsed = uploadSchema.safeParse(rawText);
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { formError: 'Aucun fichier sélectionné.' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { formError: 'La pièce dépasse 10 Mo. Merci de la compresser.' };
  }

  // Ownership check: only the owning investor can upload
  const dossier = await db.dossier.findUnique({
    where: { id: parsed.data.dossierId },
    include: { investorProfile: true },
  });
  if (!dossier) return { formError: 'Dossier introuvable.' };
  if (dossier.investorProfile.userId !== session.user.id) {
    return { formError: 'Vous ne pouvez pas modifier ce dossier.' };
  }
  if (dossier.state !== DossierState.DRAFT && dossier.state !== DossierState.SUBMITTED) {
    return { formError: 'Le dossier ne peut plus être modifié à ce stade.' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().put(buffer, {
    name: file.name,
    contentType: file.type || 'application/octet-stream',
    folder: `dossier-${dossier.id}`,
  });

  // Upsert: replace any existing doc of the same kind
  await db.document.deleteMany({
    where: { dossierId: dossier.id, kind: parsed.data.kind },
  });

  await db.document.create({
    data: {
      dossierId: dossier.id,
      kind: parsed.data.kind,
      fileName: file.name,
      storageUri: stored.uri,
      sha256: stored.sha256,
      sizeBytes: stored.sizeBytes,
      mimeType: stored.contentType,
      verification: VerificationState.PENDING,
    },
  });

  revalidatePath(`/investor/dossier/${dossier.id}`);
  return { ok: { kind: parsed.data.kind } };
}

// =====================================================================
// SUBMIT DOSSIER (move from DRAFT → SUBMITTED for Reception verification)
// =====================================================================

export async function submitDossierAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const dossierId = String(formData.get('dossierId') ?? '');
  const dossier = await db.dossier.findUnique({
    where: { id: dossierId },
    include: { investorProfile: true, documents: true },
  });
  if (!dossier) throw new Error('Dossier introuvable.');
  if (dossier.investorProfile.userId !== session.user.id) {
    throw new Error('Vous ne pouvez pas modifier ce dossier.');
  }

  // Verify all 6 mandatory pieces are present
  const present = new Set(dossier.documents.map((d) => d.kind));
  const missing = MANDATORY_DOCS.filter((m) => !present.has(m.kind));
  if (missing.length > 0) {
    throw new Error(
      `Pièces manquantes : ${missing.map((m) => m.label).join(', ')}`,
    );
  }

  await db.dossier.update({
    where: { id: dossier.id },
    data: {
      state: DossierState.SUBMITTED,
      submittedAt: new Date(),
      history: {
        create: {
          actorUserId: session.user.id ?? null,
          action: `Dossier ${dossier.reference} soumis (vérification des pièces en cours)`,
        },
      },
    },
  });

  // Notify Reception staff
  const receptionStaff = await db.user.findMany({
    where: { userType: UserType.STAFF, staffRole: 'RECEPTION', status: 'ACTIVE' },
  });
  if (receptionStaff.length) {
    await db.notification.createMany({
      data: receptionStaff.map((u) => ({
        forUserId: u.id,
        dossierId: dossier.id,
        icon: '📥',
        iconClass: 'amber',
        title: `Nouveau dossier soumis : ${dossier.reference} · ${dossier.investorProfile.raisonSociale}`,
      })),
    });
  }

  revalidatePath('/investor');
  revalidatePath(`/investor/dossier/${dossier.id}`);
  revalidatePath('/staff/inbox');
  redirect(`/investor/dossier/${dossier.id}`);
}
