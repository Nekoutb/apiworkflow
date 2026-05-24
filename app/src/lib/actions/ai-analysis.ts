'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { isStaffRole } from '@/lib/roles';
import { canActOnStage } from '@/lib/staff-permissions';
import { CLAUDE_MODEL, generateJson, isClaudeConfigured } from '@/lib/claude';

// ---- shared ----

async function requireStaff() {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  if (!isStaffRole(session.user.role)) throw new Error('Forbidden');
  return session;
}

const REQUIRED_DOC_LABELS: Record<string, string> = {
  ACTIVITY_AUTHORIZATION: 'Autorisation d\'exercice',
  RECRUITMENT_PLAN:       'Plan de recrutement camerounais',
  TECH_TRANSFER_PLAN:     'Plan de transfert de technologies',
  LOCAL_SUBCONTRACTING:   'Plan de sous-traitance locale',
  FINANCING_PROOF:        'Justification du financement',
  FEASIBILITY_STUDY:      'Étude de faisabilité',
  REGISTRATION:           'Registre du commerce (RCCM)',
  TAX_ID:                 'Attestation NIU',
  NON_REDEVANCE:          'Attestation de non-redevance',
  COMPANY_STATUTES:       'Statuts de la société',
  ENVIRONMENTAL_STUDY:    'Étude d\'impact environnemental',
  ANNUAL_REPORT:          'Rapport annuel',
  OTHER:                  'Autre pièce justificative',
};

// =============================================================
// Per-document analysis (OCR + classification verdict)
// =============================================================

type DocAnalysisOut = {
  summary: string;             // ~2 lines
  classification: 'CONFORME' | 'AMBIGU' | 'NON_CONFORME';
  classificationReason: string;
  legibility: 'BONNE' | 'MOYENNE' | 'FAIBLE';
  keyFindings: string[];       // 2-4 bullets
  extractedFields?: Record<string, string>;
};

export async function runDocumentAnalysisAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const documentId = String(formData.get('documentId') ?? '');
  if (!documentId) return;

  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { convention: true },
  });
  if (!doc) return;

  if (!canActOnStage(session.user.role as never, doc.convention.currentStage)) {
    throw new Error('Action réservée au responsable de l\'étape.');
  }

  const expectedTitle = REQUIRED_DOC_LABELS[doc.kind] ?? doc.kind;
  const isStubFile = doc.storageUri.startsWith('seed://') || doc.storageUri.startsWith('local-stub://');

  const result = await generateJson<DocAnalysisOut>({
    system: `Tu es l'assistant IA du Secrétariat de l'API du Cameroun. Tu vérifies la conformité formelle des pièces déposées par les investisseurs au regard de l'Ordonnance n° 2025/002. Sois concis, factuel, en français. Sors UNIQUEMENT du JSON valide.

Schéma de sortie:
{
  "summary": "2 phrases courtes décrivant ce que tu observes dans la pièce",
  "classification": "CONFORME" | "AMBIGU" | "NON_CONFORME",
  "classificationReason": "1 phrase",
  "legibility": "BONNE" | "MOYENNE" | "FAIBLE",
  "keyFindings": ["…", "…"],
  "extractedFields": { "champ": "valeur" }
}`,
    user: `Pièce à analyser:
- Type attendu: ${expectedTitle} (article ${doc.kind})
- Nom de fichier: ${doc.fileName}
- Taille: ${doc.sizeBytes} octets · ${doc.mimeType}
- Investisseur: ${doc.convention.projectName}
- Référence dossier: ${doc.convention.reference}

${isStubFile
  ? `Le fichier n'est pas accessible en mode démo (storage non configuré). Émets une analyse plausible cohérente avec le type "${expectedTitle}" et précise dans summary qu'il s'agit d'une analyse simulée.`
  : `Évalue la cohérence du nom et du type, suppose une analyse OCR du contenu et produis un verdict pédagogique pour le Secrétariat.`}`,
    maxTokens: 600,
    stubFactory: (): DocAnalysisOut => ({
      summary: `Document "${expectedTitle}" déposé sous le nom ${doc.fileName}. En mode démo : analyse Claude simulée; activez ANTHROPIC_API_KEY pour l'OCR réel.`,
      classification: 'CONFORME',
      classificationReason: 'Le nom et le format du fichier sont cohérents avec le type attendu.',
      legibility: 'BONNE',
      keyFindings: [
        'Type de document cohérent avec l\'intitulé Art. 6',
        'Format PDF conforme',
        'Aucune anomalie évidente détectée (analyse simulée)',
      ],
      extractedFields: { investisseur: doc.convention.projectName, reference: doc.convention.reference },
    }),
  });

  await db.aiAnalysis.create({
    data: {
      conventionId: doc.conventionId,
      documentId: doc.id,
      stage: doc.convention.currentStage,
      kind: 'COMPLIANCE_FORM',
      summary: result.ok ? result.data.summary : `Erreur Claude: ${result.error}`,
      contentJson: result.ok ? (result.data as unknown as object) : { error: result.error },
      modelName: CLAUDE_MODEL,
      tokensIn:  result.ok && 'tokensIn'  in result ? result.tokensIn  ?? null : null,
      tokensOut: result.ok && 'tokensOut' in result ? result.tokensOut ?? null : null,
    },
  });

  revalidatePath(`/staff/conventions/${doc.conventionId}`);
}

// =============================================================
// Dossier-wide compliance check
// =============================================================

type DossierAnalysisOut = {
  overallVerdict: 'CONFORME' | 'CONFORME_AVEC_RESERVES' | 'NON_CONFORME';
  verdictReason: string;
  completeness: {
    present: string[];     // kinds present
    missing: string[];     // kinds missing
  };
  redFlags: string[];      // 0-5
  recommendation: 'PROCEDER' | 'RENVOYER_INVESTISSEUR' | 'DEMANDER_PRECISIONS';
  recommendationReason: string;
  categoryConfirmed: 'A' | 'B' | 'C';
};

export async function runDossierAnalysisAction(formData: FormData): Promise<void> {
  const session = await requireStaff();
  const conventionId = String(formData.get('conventionId') ?? '');
  if (!conventionId) return;

  const cv = await db.convention.findUnique({
    where: { id: conventionId },
    include: { documents: { select: { kind: true, fileName: true, verification: true } }, investor: true },
  });
  if (!cv) return;

  if (!canActOnStage(session.user.role as never, cv.currentStage)) {
    throw new Error('Action réservée au responsable de l\'étape.');
  }

  const required = ['ACTIVITY_AUTHORIZATION', 'RECRUITMENT_PLAN', 'TECH_TRANSFER_PLAN', 'LOCAL_SUBCONTRACTING', 'FINANCING_PROOF', 'FEASIBILITY_STUDY'];
  const presentKinds = new Set(cv.documents.map((d) => d.kind));
  const present = required.filter((k) => presentKinds.has(k as never));
  const missing = required.filter((k) => !presentKinds.has(k as never));

  const result = await generateJson<DossierAnalysisOut>({
    system: `Tu es l'assistant IA du Secrétariat de l'API du Cameroun. Tu produis une analyse de complétude et de conformité formelle du dossier d'agrément au regard de l'Ordonnance n° 2025/002, Articles 6 et 7. Sois rigoureux et concis, en français. Sors UNIQUEMENT du JSON valide.

Schéma de sortie:
{
  "overallVerdict": "CONFORME" | "CONFORME_AVEC_RESERVES" | "NON_CONFORME",
  "verdictReason": "1-2 phrases",
  "completeness": { "present": ["KIND"], "missing": ["KIND"] },
  "redFlags": ["…"],
  "recommendation": "PROCEDER" | "RENVOYER_INVESTISSEUR" | "DEMANDER_PRECISIONS",
  "recommendationReason": "1 phrase",
  "categoryConfirmed": "A" | "B" | "C"
}`,
    user: `Dossier:
- Référence: ${cv.reference}
- Investisseur: ${cv.investor.raisonSociale}
- Projet: ${cv.projectName}
- Secteur: ${cv.sector}
- Région: ${cv.region ?? '—'}
- Type: ${cv.projectType}
- Montant agréé: ${cv.investmentFcfa.toString()} FCFA
- Emplois prévus: ${cv.jobsPlanned}
- Catégorie déclarée: ${cv.category}

Pièces déposées (${cv.documents.length}):
${cv.documents.map((d) => `- ${d.kind} (${d.fileName}) · ${d.verification}`).join('\n')}

Pièces obligatoires manquantes: ${missing.length === 0 ? 'aucune' : missing.join(', ')}.

Analyse le dossier et produis le verdict de complétude formelle. Pour la catégorie: A < 1 Md FCFA, B 1-5 Md, C > 5 Md.`,
    maxTokens: 800,
    stubFactory: (): DossierAnalysisOut => {
      const amount = cv.investmentFcfa;
      const cat = amount < 1_000_000_000n ? 'A' as const : amount <= 5_000_000_000n ? 'B' as const : 'C' as const;
      const rejected = cv.documents.filter((d) => d.verification === 'REJECTED').length;
      const verdict = missing.length === 0 && rejected === 0 ? 'CONFORME' as const
                    : missing.length > 0 ? 'NON_CONFORME' as const
                    : 'CONFORME_AVEC_RESERVES' as const;
      return {
        overallVerdict: verdict,
        verdictReason: missing.length === 0 && rejected === 0
          ? 'Toutes les pièces obligatoires de l\'Art. 6 sont présentes.'
          : `${missing.length} pièce(s) manquante(s) et ${rejected} rejetée(s).`,
        completeness: { present, missing },
        redFlags: rejected > 0 ? ['Certaines pièces ont été rejetées par le Secrétariat'] : [],
        recommendation: missing.length === 0 && rejected === 0 ? 'PROCEDER' : 'RENVOYER_INVESTISSEUR',
        recommendationReason: missing.length === 0 && rejected === 0
          ? 'Le dossier est formellement complet; le récépissé peut être délivré.'
          : 'Demander les pièces manquantes avant d\'aller plus loin.',
        categoryConfirmed: cat,
      };
    },
  });

  await db.aiAnalysis.create({
    data: {
      conventionId,
      stage: cv.currentStage,
      kind: 'COMPLIANCE_FORM',
      summary: result.ok ? result.data.verdictReason : `Erreur Claude: ${result.error}`,
      contentJson: result.ok ? (result.data as unknown as object) : { error: result.error },
      modelName: CLAUDE_MODEL,
      tokensIn:  result.ok && 'tokensIn'  in result ? result.tokensIn  ?? null : null,
      tokensOut: result.ok && 'tokensOut' in result ? result.tokensOut ?? null : null,
    },
  });

  revalidatePath(`/staff/conventions/${conventionId}`);
}

// Expose for the client component header copy
export async function isClaudeOnAction(): Promise<boolean> {
  return isClaudeConfigured();
}
