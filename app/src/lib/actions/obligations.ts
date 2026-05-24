'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { storePdf } from '@/lib/blob-storage';
import { computeRoyalty, EXTENSION_MONTHS_MAX, type ActionState } from '@/lib/obligations-config';
import { MAX_UPLOAD_BYTES, ACCEPTED_MIME } from '@/lib/required-documents';

// ---- shared helpers ----

async function requireInvestorOwning(conventionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  if (session.user.role && session.user.role !== 'INVESTOR') throw new Error('Forbidden');

  const investor = await db.investor.findUnique({
    where: { userId: session.user.id },
  });
  if (!investor) throw new Error('Profil investisseur introuvable.');

  const cv = await db.convention.findUnique({ where: { id: conventionId } });
  if (!cv || cv.investorId !== investor.id) throw new Error('Convention introuvable.');
  if (cv.status !== 'SIGNED' && cv.status !== 'CLOSED') {
    throw new Error('Cette convention n\'est pas encore signée.');
  }

  return { session, investor, convention: cv };
}

async function maybeUploadAttachment(
  conventionId: string,
  kindPrefix: string,
  file: File | null,
): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Pièce jointe > 10 Mo.');
  }
  const type = file.type || 'application/pdf';
  if (!ACCEPTED_MIME.includes(type as 'application/pdf')) {
    throw new Error('Pièce jointe : PDF uniquement.');
  }
  const stored = await storePdf({
    pathname: `conventions/${conventionId}/${kindPrefix}-${Date.now()}.pdf`,
    file,
  });
  return stored.url;
}

// =============================================================
// Art. 32 — Annual report
// =============================================================

export async function submitAnnualReportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let convention;
  try {
    ({ convention } = await requireInvestorOwning(String(formData.get('conventionId') ?? '')));
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  const fiscalYear = Number(formData.get('fiscalYear') ?? 0);
  if (!Number.isFinite(fiscalYear) || fiscalYear < 2020 || fiscalYear > 2100) {
    return { status: 'error', error: 'Exercice fiscal invalide.' };
  }

  const jobsActual           = optInt(formData.get('jobsActual'));
  const investmentActualFcfa = optBigInt(formData.get('investmentActualFcfa'));
  const exportsActualFcfa    = optBigInt(formData.get('exportsActualFcfa'));
  const localPurchasesFcfa   = optBigInt(formData.get('localPurchasesFcfa'));
  const notes                = String(formData.get('notes') ?? '').trim() || null;

  let attachmentUri: string | null = null;
  try {
    attachmentUri = await maybeUploadAttachment(
      convention.id, `annual-report-${fiscalYear}`,
      formData.get('attachment') as File | null,
    );
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  // Late detection — hard deadline 31 March of year+1 (Art. 32.1)
  const deadline = new Date(Date.UTC(fiscalYear + 1, 2, 31)); // March = 2
  const now = new Date();
  const isLate = now > deadline;
  const monthsLate = isLate
    ? Math.max(0, monthsBetween(deadline, now))
    : 0;
  const fineAccruedFcfa = BigInt(monthsLate) * 1_000_000n;

  await db.annualReport.upsert({
    where: { conventionId_fiscalYear: { conventionId: convention.id, fiscalYear } },
    create: {
      conventionId: convention.id,
      investorId: convention.investorId,
      fiscalYear,
      jobsActual,
      investmentActualFcfa,
      exportsActualFcfa,
      localPurchasesFcfa,
      notes,
      attachmentUri,
      isLate,
      monthsLate,
      fineAccruedFcfa,
    },
    update: {
      jobsActual,
      investmentActualFcfa,
      exportsActualFcfa,
      localPurchasesFcfa,
      notes,
      attachmentUri: attachmentUri ?? undefined,
      isLate,
      monthsLate,
      fineAccruedFcfa,
    },
  });

  revalidatePath(`/investor/conventions/${convention.id}/obligations`);
  redirect(`/investor/conventions/${convention.id}/obligations?ok=annual-report-${fiscalYear}`);
}

// =============================================================
// Art. 33 — Equipment list
// =============================================================

export async function submitEquipmentListAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let convention;
  try {
    ({ convention } = await requireInvestorOwning(String(formData.get('conventionId') ?? '')));
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  const raw = String(formData.get('itemsJson') ?? '[]');
  let items: Array<{ description: string; qty: number; hsCode?: string; unitValueFcfa: number }>;
  try {
    items = JSON.parse(raw);
  } catch {
    return { status: 'error', error: 'Liste d\'équipements invalide.' };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { status: 'error', error: 'Au moins une ligne d\'équipement est requise.' };
  }

  const totalValueFcfa = items.reduce(
    (acc, it) => acc + BigInt(Math.max(0, Math.floor(it.qty ?? 0))) * BigInt(Math.max(0, Math.floor(it.unitValueFcfa ?? 0))),
    0n,
  );

  let attachmentUri: string | null = null;
  try {
    attachmentUri = await maybeUploadAttachment(
      convention.id, 'equipment-list',
      formData.get('attachment') as File | null,
    );
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  await db.equipmentList.upsert({
    where: { conventionId: convention.id },
    create: {
      conventionId: convention.id,
      itemsJson: items,
      totalValueFcfa,
      attachmentUri,
    },
    update: {
      itemsJson: items,
      totalValueFcfa,
      attachmentUri: attachmentUri ?? undefined,
      submittedAt: new Date(),
    },
  });

  revalidatePath(`/investor/conventions/${convention.id}/obligations`);
  redirect(`/investor/conventions/${convention.id}/obligations?ok=equipment-list`);
}

// =============================================================
// Art. 48 — Royalty payment
// =============================================================

export async function declareRoyaltyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let convention;
  try {
    ({ convention } = await requireInvestorOwning(String(formData.get('conventionId') ?? '')));
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  const fiscalYear = Number(formData.get('fiscalYear') ?? 0);
  if (!Number.isFinite(fiscalYear)) {
    return { status: 'error', error: 'Exercice invalide.' };
  }
  const amountDueFcfa = computeRoyalty(convention.investmentFcfa);

  let proofUri: string | null = null;
  try {
    proofUri = await maybeUploadAttachment(
      convention.id, `royalty-${fiscalYear}`,
      formData.get('proof') as File | null,
    );
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  const amountPaidFcfa = optBigInt(formData.get('amountPaidFcfa'));

  await db.royaltyPayment.upsert({
    where: { conventionId_fiscalYear: { conventionId: convention.id, fiscalYear } },
    create: {
      conventionId: convention.id,
      fiscalYear,
      amountDueFcfa,
      amountPaidFcfa,
      paidAt: amountPaidFcfa ? new Date() : null,
      proofUri,
      status: amountPaidFcfa ? 'PAID' : 'PENDING',
    },
    update: {
      amountDueFcfa,
      amountPaidFcfa,
      paidAt: amountPaidFcfa ? new Date() : null,
      proofUri: proofUri ?? undefined,
      status: amountPaidFcfa ? 'PAID' : 'PENDING',
    },
  });

  revalidatePath(`/investor/conventions/${convention.id}/obligations`);
  redirect(`/investor/conventions/${convention.id}/obligations?ok=royalty-${fiscalYear}`);
}

// =============================================================
// Art. 36 — Extension request
// =============================================================

export async function submitExtensionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let convention;
  try {
    ({ convention } = await requireInvestorOwning(String(formData.get('conventionId') ?? '')));
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  const reason = String(formData.get('reason') ?? '').trim();
  const requestedMonths = Number(formData.get('requestedMonths') ?? 0);

  if (!reason || reason.length < 20) {
    return { status: 'error', error: 'La motivation doit faire au moins 20 caractères.' };
  }
  if (!Number.isFinite(requestedMonths) || requestedMonths <= 0 || requestedMonths > EXTENSION_MONTHS_MAX) {
    return { status: 'error', error: `Le nombre de mois doit être entre 1 et ${EXTENSION_MONTHS_MAX}.` };
  }

  let attachmentUri: string | null = null;
  try {
    attachmentUri = await maybeUploadAttachment(
      convention.id, 'extension-request',
      formData.get('attachment') as File | null,
    );
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  await db.extensionRequest.create({
    data: {
      conventionId: convention.id,
      reason,
      requestedMonths,
      attachmentUri,
    },
  });

  revalidatePath(`/investor/conventions/${convention.id}/obligations`);
  redirect(`/investor/conventions/${convention.id}/obligations?ok=extension`);
}

// =============================================================
// Art. 34 — Attestation de réalisation
// =============================================================

export async function submitAttestationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let convention;
  try {
    ({ convention } = await requireInvestorOwning(String(formData.get('conventionId') ?? '')));
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  const expectedDateStr = String(formData.get('expectedCompletionDate') ?? '');
  const notes           = String(formData.get('notes') ?? '').trim() || null;

  const expectedCompletionDate = expectedDateStr ? new Date(expectedDateStr) : null;
  if (!expectedCompletionDate || isNaN(expectedCompletionDate.getTime())) {
    return { status: 'error', error: 'Date d\'achèvement prévue invalide.' };
  }

  let attachmentUri: string | null = null;
  try {
    attachmentUri = await maybeUploadAttachment(
      convention.id, 'attestation-request',
      formData.get('attachment') as File | null,
    );
  } catch (e) {
    return { status: 'error', error: (e as Error).message };
  }

  await db.attestationRequest.upsert({
    where: { conventionId: convention.id },
    create: {
      conventionId: convention.id,
      expectedCompletionDate,
      notes,
      attachmentUri,
    },
    update: {
      expectedCompletionDate,
      notes,
      attachmentUri: attachmentUri ?? undefined,
      submittedAt: new Date(),
    },
  });

  revalidatePath(`/investor/conventions/${convention.id}/obligations`);
  redirect(`/investor/conventions/${convention.id}/obligations?ok=attestation`);
}

// =============================================================
// helpers
// =============================================================

function optInt(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').replace(/[^\d]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function optBigInt(v: FormDataEntryValue | null): bigint | null {
  const s = String(v ?? '').replace(/[^\d]/g, '');
  if (!s) return null;
  try { return BigInt(s); } catch { return null; }
}

function monthsBetween(a: Date, b: Date): number {
  return Math.max(0, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()));
}
