'use server';

import { auth } from '@/lib/auth';
import { analyzeDocument, isClaudeConfigured } from '@/lib/claude';
import type { StaffRole, DocumentNature } from '@prisma/client';

// ============================================================================
//  Server action — OCR + structured extraction for an uploaded courrier
//  (B4 enhancement, after the form's file picker.)
//
//  Called from RegisterForm.tsx the moment the user selects a file.
//  Returns the fields the form should pre-fill + a 50-word synopsis the
//  AI panel displays.
//
//  Permission: same as the parent form — courrier roles only.
//  Cost   : ~$0.01–0.05 per analysis on the Claude vision API.
//  Latency: 2–6 s typical for a 1-page PDF.
// ============================================================================

export type AnalyzedDocument = {
  // All optional — the model only fills what it can read confidently
  senderName?: string;
  senderEmail?: string;
  senderOrganization?: string;
  senderPhone?: string;
  senderType?: 'Investisseur' | 'Particulier' | 'Administration' | 'Entreprise' | 'Autre';

  subject?: string;
  nature?: DocumentNature;

  // The headline output: a tight French summary in ≤ 50 words.
  // Format suggestion: "Document de XXX adressé à XXX, [verbe court] [objet],
  // pour un montant estimé à XXX."
  synopsis: string;

  // Self-reported quality so the UI can show a warning when low
  confidence: 'high' | 'medium' | 'low';

  // Optional list of fields the model says are visible in the document
  // (helps the UI badge "filled from document" vs "guessed")
  fieldsFromDocument?: string[];
};

export type AnalyzeResult =
  | { ok: true; data: AnalyzedDocument; mode: 'live' | 'stub' }
  | { ok: false; error: string };

const ALLOWED_ROLES: StaffRole[] = [
  'ADMIN',
  'CHEF_BUREAU_ARRIVEE',
  'CHEF_SERVICE_COURRIER',
];

const ACCEPTED_MIMETYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — same cap as the upload form

const SYSTEM_PROMPT = `Tu es un assistant d'analyse de courrier pour l'Agence de Promotion des Investissements du Cameroun (API).

Tu reçois un courrier scanné (PDF ou image) qui vient d'arriver au Bureau Arrivée. Ton rôle est d'extraire les métadonnées que l'agent va saisir dans le formulaire d'enregistrement officiel.

Tu réponds en JSON exclusivement (aucun texte hors JSON). Tu utilises le français du Cameroun pour toutes les valeurs textuelles. Si une information n'est pas visible dans le document, tu omets le champ (ne devine pas).

Pour le champ "nature", choisis parmi cette liste exacte:
- AGREMENT_REQUEST: demande d'agrément (Ordonnance 2025/002), demande d'incitation, demande d'avantages fiscaux
- GENERAL_CORRESPONDENCE: correspondance générale, lettre administrative
- OFFICIAL_NOTIFICATION: notification officielle d'une administration (ministère, douane, impôts, etc.)
- PARTNERSHIP_PROPOSAL: proposition de partenariat commercial ou institutionnel
- COMPLAINT: réclamation, plainte
- REPORT: rapport (annuel, technique, financier)
- OTHER: aucune des catégories ci-dessus

Pour "senderType", choisis: Investisseur | Particulier | Administration | Entreprise | Autre.

Pour "synopsis": rédige une phrase unique de 30–50 mots maximum qui capture l'essentiel — émetteur, destinataire si différent du DG, objet/demande, et montant ou volume si mentionné. Exemple: "Lettre de Cameroun Solar Power SA adressée au DG, sollicitant l'agrément au régime des grands investissements pour une centrale solaire de 50 MW à Édéa, pour un montant total de 32,5 milliards de FCFA."

Pour "confidence":
- high  = au moins 4 champs structurés bien identifiés
- medium = 2 ou 3 champs bien identifiés
- low   = document peu lisible ou structure inhabituelle

Pour "fieldsFromDocument": liste les noms de champs que tu as réellement lus (vs devinés), parmi: senderName, senderEmail, senderOrganization, senderPhone, subject, nature.`;

const USER_PROMPT = `Analyse ce courrier et retourne le JSON suivant la spécification du system prompt.`;

export async function analyzeUploadedDocument(formData: FormData): Promise<AnalyzeResult> {
  try {
    // ---- AuthZ ----
    const session = await auth();
    const role = session?.user?.role as StaffRole | undefined;
    if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
      return { ok: false, error: 'Vous n\'avez pas les droits Service du Courrier.' };
    }

    // ---- File ----
    const file = formData.get('document') as File | null;
    if (!file || file.size === 0) {
      return { ok: false, error: 'Aucun fichier reçu.' };
    }
    if (file.size > MAX_BYTES) {
      return { ok: false, error: 'Fichier trop volumineux (10 Mo max).' };
    }
    if (!ACCEPTED_MIMETYPES.has(file.type)) {
      return { ok: false, error: `Type non supporté: ${file.type || 'inconnu'}` };
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ---- Claude call ----
    const result = await analyzeDocument<AnalyzedDocument>({
      system: SYSTEM_PROMPT,
      user: USER_PROMPT,
      file: buffer,
      mimeType: file.type,
      maxTokens: 1024,
      stubFactory: () => stubAnalysis(file.name),
    });

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    // Light defensive cleanup — drop empty strings, clamp synopsis length
    const d = result.data;
    const clean: AnalyzedDocument = {
      ...d,
      synopsis: truncateWords(String(d.synopsis ?? ''), 55),
      confidence: d.confidence ?? 'medium',
    };
    for (const k of ['senderName', 'senderEmail', 'senderOrganization', 'senderPhone', 'subject'] as const) {
      if (clean[k] !== undefined && (clean[k] as string).trim() === '') delete clean[k];
    }

    return { ok: true, data: clean, mode: result.mode };
  } catch (e) {
    console.error('[analyzeUploadedDocument]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

export async function isAiEnabled(): Promise<{ enabled: boolean; reason?: string }> {
  if (isClaudeConfigured()) return { enabled: true };
  return {
    enabled: false,
    reason:
      'Clé ANTHROPIC_API_KEY non définie sur le serveur. L\'extraction automatique sera désactivée — vous pouvez saisir les champs manuellement.',
  };
}

function truncateWords(s: string, max: number): string {
  const words = s.split(/\s+/);
  if (words.length <= max) return s.trim();
  return words.slice(0, max).join(' ').trim() + '…';
}

// Stub used when ANTHROPIC_API_KEY is absent. Returns plausible placeholder
// data so the front-end flow can be tested end-to-end without a real key.
function stubAnalysis(fileName: string): AnalyzedDocument {
  return {
    senderName: 'Aïcha Bouba',
    senderEmail: 'contact@solarcm.cm',
    senderOrganization: 'Cameroun Solar Power SA',
    senderPhone: '+237 6 55 44 33 22',
    senderType: 'Investisseur',
    subject: "Demande d'agrément · centrale solaire 50 MW Édéa",
    nature: 'AGREMENT_REQUEST',
    synopsis:
      "[Mode démo · ANTHROPIC_API_KEY absente] Document de démonstration tiré du nom de fichier « " +
      fileName +
      " ». Configurez la clé Anthropic sur le serveur pour activer l'analyse réelle du courrier scanné.",
    confidence: 'low',
    fieldsFromDocument: [],
  };
}
