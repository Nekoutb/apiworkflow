'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';
import { analyzeDocument, isClaudeConfigured } from '@/lib/claude';
import { ROLES, roleLabel, ROLE_GROUP_LABEL_FR, type RoleGroup } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';

// ============================================================================
//  Server action: produce / cache a dispatch suggestion for the DG (B7).
//
//  Inputs: documentId (DG must hold it = AWAITING_DG_ANALYSIS)
//  Output: { summary: 50w synopsis, suggestedRole: StaffRole, reasoning: short
//           paragraph why, confidence: high|medium|low, alternatives: [] }
//
//  Cached on AiAnalysis (kind = ASSIGNMENT_SUGGESTION) so re-opening the
//  document doesn't re-burn Claude tokens. A "force" flag lets the DG
//  request a fresh analysis (in case the OCR was bad first time).
// ============================================================================

const ALLOWED_ROLES: StaffRole[] = ['DG', 'DGA', 'ADMIN'];

async function assertDgOrAdmin(): Promise<{ id: string }> {
  const session = await auth();
  const role = session?.user?.role as StaffRole | undefined;
  if (!session?.user || !role || !ALLOWED_ROLES.includes(role)) {
    throw new Error('UNAUTHORIZED');
  }
  return { id: session.user.id! };
}

export type DispatchSuggestion = {
  summary: string;
  suggestedRole: StaffRole;
  reasoning: string;
  confidence: 'high' | 'medium' | 'low';
  alternatives?: StaffRole[];
};

export type AnalyzeResult =
  | {
      ok: true;
      data: DispatchSuggestion;
      mode: 'live' | 'stub' | 'cached';
      generatedAt: Date;
      modelName?: string | null;
    }
  | { ok: false; error: string };

/** Used by the DG detail page to render either the cached suggestion or
 *  spin a fresh Claude call when none exists. */
export async function getOrComputeDispatchSuggestion(
  documentId: string,
  opts: { force?: boolean } = {},
): Promise<AnalyzeResult> {
  try {
    await assertDgOrAdmin();

    // ---- Check cache first ----
    if (!opts.force) {
      const cached = await db.aiAnalysis.findFirst({
        where: { documentId, kind: 'ASSIGNMENT_SUGGESTION' },
        orderBy: { generatedAt: 'desc' },
      });
      if (cached?.contentJson) {
        const data = cached.contentJson as unknown as DispatchSuggestion;
        return {
          ok: true,
          data,
          mode: 'cached',
          generatedAt: cached.generatedAt,
          modelName: cached.modelName,
        };
      }
    }

    // ---- Load the document + its latest ORIGINAL/SCANNED version ----
    const doc = await db.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        reference: true,
        subject: true,
        nature: true,
        submission: {
          select: { senderName: true, senderOrganization: true, senderType: true },
        },
        versions: {
          where: { kind: { in: ['ORIGINAL', 'SCANNED'] } },
          orderBy: { uploadedAt: 'asc' },
          take: 1,
          select: { fileName: true, mimeType: true, storageUri: true, sha256: true },
        },
      },
    });
    if (!doc) return { ok: false, error: 'Document introuvable.' };

    // ---- Build system prompt with the organigramme tree ----
    const system = buildDispatchSystemPrompt();
    const user = buildDispatchUserPrompt(doc);

    // ---- Call Claude (with stub fallback) ----
    let result;
    const version = doc.versions[0];
    const haveLiveFile = version && !version.storageUri.startsWith('local-stub://');

    if (haveLiveFile && isClaudeConfigured()) {
      // Future enhancement: actually download the file bytes and pass them.
      // For now we send the metadata only — the model decides from the subject
      // + sender + nature. When Vercel Blob is wired up (B14.5 / observability),
      // we'll re-fetch the file here and pass it as a document attachment.
      result = await analyzeDocument<DispatchSuggestion>({
        system,
        user,
        file: Buffer.from(''), // no bytes; analyzeDocument falls back to text-only
        mimeType: 'application/pdf',
        maxTokens: 1024,
        stubFactory: () => stubSuggestion(doc),
      });
    } else {
      // Pure text path — no file attachment
      result = await analyzeTextOnly<DispatchSuggestion>({
        system,
        user,
        stubFactory: () => stubSuggestion(doc),
      });
    }

    if (!result.ok) return { ok: false, error: result.error };

    // ---- Validate the suggested role ----
    const validRoles = new Set(ROLES.map((r) => r.role));
    if (!validRoles.has(result.data.suggestedRole)) {
      result.data.suggestedRole = 'DGA'; // safe fallback
      result.data.confidence = 'low';
    }
    if (result.data.alternatives) {
      result.data.alternatives = result.data.alternatives.filter((r) => validRoles.has(r));
    }

    // ---- Cache ----
    const cached = await db.aiAnalysis.create({
      data: {
        documentId,
        kind: 'ASSIGNMENT_SUGGESTION',
        summary: result.data.summary,
        contentJson: result.data as unknown as object,
        modelName: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5',
        tokensIn: 'tokensIn' in result ? result.tokensIn ?? null : null,
        tokensOut: 'tokensOut' in result ? result.tokensOut ?? null : null,
      },
    });

    revalidatePath(`/dg/parapheur/${documentId}`);
    return {
      ok: true,
      data: result.data,
      mode: result.mode,
      generatedAt: cached.generatedAt,
      modelName: cached.modelName,
    };
  } catch (e) {
    if (e instanceof Error && e.message === 'UNAUTHORIZED') {
      return { ok: false, error: 'Vous n\'avez pas les droits DG.' };
    }
    console.error('[getOrComputeDispatchSuggestion]', e);
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur inconnue' };
  }
}

/** Convenience action — force a re-analysis (used by the "Re-analyser" button). */
export async function reanalyzeDispatch(documentId: string): Promise<AnalyzeResult> {
  return getOrComputeDispatchSuggestion(documentId, { force: true });
}

// ----------------------------------------------------------------------------
// Pure-text Claude path (used when no file attachment is available)
// ----------------------------------------------------------------------------

import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '@/lib/claude';

type ClaudeJsonOk<T> = {
  ok: true;
  data: T;
  mode: 'live' | 'stub';
  tokensIn?: number;
  tokensOut?: number;
};
type ClaudeJsonErr = { ok: false; error: string };

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _client;
}

async function analyzeTextOnly<T>(args: {
  system: string;
  user: string;
  stubFactory: () => T;
  maxTokens?: number;
}): Promise<ClaudeJsonOk<T> | ClaudeJsonErr> {
  if (!isClaudeConfigured()) {
    return { ok: true, data: args.stubFactory(), mode: 'stub' };
  }
  try {
    const msg = await client().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: args.maxTokens ?? 1024,
      system: args.system + '\n\nRESPONSE FORMAT: return only a valid JSON object, no prose, no markdown fences.',
      messages: [{ role: 'user', content: args.user }],
    });
    const text = msg.content
      .filter((c) => c.type === 'text')
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('\n');
    const data = parseJsonBlob<T>(text);
    if (!data) return { ok: false, error: 'Réponse Claude non parsable' };
    return { ok: true, data, mode: 'live', tokensIn: msg.usage.input_tokens, tokensOut: msg.usage.output_tokens };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'unknown' };
  }
}

function parseJsonBlob<T>(text: string): T | null {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed) as T; } catch { /* */ }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]) as T; } catch { /* */ } }
  const first = trimmed.indexOf('{'); const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1) {
    try { return JSON.parse(trimmed.slice(first, last + 1)) as T; } catch { /* */ }
  }
  return null;
}

// ----------------------------------------------------------------------------
// Prompts + stub
// ----------------------------------------------------------------------------

function buildDispatchSystemPrompt(): string {
  // Embed the organigramme grouped by Direction so the model has the full
  // list of valid suggestedRole enum values + their human-readable French
  // labels + their hierarchical context.
  const groups = Object.keys(ROLE_GROUP_LABEL_FR) as RoleGroup[];
  const tree = groups
    .map((g) => {
      const groupLabel = ROLE_GROUP_LABEL_FR[g];
      const roles = ROLES.filter((r) => r.group === g)
        .map((r) => `    ${r.role}: ${r.fr}${r.parent ? ` (sous ${r.parent})` : ''}`)
        .join('\n');
      return `  ${groupLabel}:\n${roles}`;
    })
    .join('\n');

  return `Tu es l'assistant du Directeur Général de l'Agence de Promotion des Investissements du Cameroun.

Le DG reçoit chaque jour des courriers via le Bureau Arrivée. Ton rôle est de suggérer à quelle unité de l'organigramme officiel le DG devrait dispatcher chaque document.

Organigramme officiel API (Résolution du Conseil d'Administration · 02 juillet 2020) :

${tree}

Tu réponds STRICTEMENT en JSON, sans aucun texte hors JSON, avec la structure suivante :
{
  "summary": "string — synopsis du document en 40-60 mots maximum, en français du Cameroun",
  "suggestedRole": "STRING — code rôle exact issu de la liste ci-dessus (ex: DIR_PROMOTION, CHEF_SERVICE_JUR…)",
  "reasoning": "string — 2-3 phrases courtes expliquant pourquoi cette unité plutôt qu'une autre",
  "confidence": "high | medium | low",
  "alternatives": ["array de 1-2 codes rôles alternatifs, optionnel"]
}

Règles de routage typiques :
- Demande d'agrément aux régimes (Ordonnance 2025/002) → DIR_FACILITATION puis CHEF_SERVICE_AGREMENTS
- Plainte d'un investisseur → CHEF_SERVICE_ACCUEIL ou CHEF_SERVICE_JUR
- Notification ministérielle → CHEF_SERVICE_JUR ou CHEF_DIV_SUIVI
- Proposition de partenariat international → CHEF_SOUSDIR_ETRANGER ou la zone géographique
- Rapport périodique → CHEF_DIV_SUIVI
- Question fiscale → CHEF_SERVICE_SAF + CHEF_SERVICE_JUR
- Question RH interne → CHEF_SERVICE_RH
- Communication / RP → CHEF_SOUSDIR_COMM
- Quand vraiment incertain : DGA (Directeur Général Adjoint, qui répartira)

Tu choisis l'unité la plus opérationnelle (chef de service) plutôt que le sous-directeur quand c'est possible.`;
}

function buildDispatchUserPrompt(doc: {
  reference: string;
  subject: string;
  nature: string;
  submission: { senderName: string; senderOrganization: string | null; senderType: string | null } | null;
  versions: { fileName: string; mimeType: string }[];
}): string {
  return `Document à analyser :

Référence : ${doc.reference}
Nature déclarée par le Bureau Arrivée : ${doc.nature}
Objet : ${doc.subject}

Émetteur : ${doc.submission?.senderName ?? '—'}
Organisation : ${doc.submission?.senderOrganization ?? '—'}
Type : ${doc.submission?.senderType ?? '—'}

Pièce jointe : ${doc.versions[0]?.fileName ?? '(aucune)'} (${doc.versions[0]?.mimeType ?? '—'})

Analyse ce courrier et propose un dispatch en suivant strictement le format JSON du system prompt.`;
}

function stubSuggestion(doc: {
  reference: string;
  subject: string;
  nature: string;
}): DispatchSuggestion {
  // Deterministic fallback based on nature so the UI still demonstrates flow
  const byNature: Record<string, { role: StaffRole; reasoning: string }> = {
    AGREMENT_REQUEST: {
      role: 'CHEF_SERVICE_AGREMENTS',
      reasoning:
        'Les demandes d\'agrément relèvent du Service des Agréments au sein de la Direction Facilitation, conformément à l\'article 33 de l\'organigramme.',
    },
    COMPLAINT: {
      role: 'CHEF_SERVICE_ACCUEIL',
      reasoning:
        'Les réclamations sont d\'abord traitées par le Service Accueil & Assistance avant escalade éventuelle au juridique.',
    },
    OFFICIAL_NOTIFICATION: {
      role: 'CHEF_SERVICE_JUR',
      reasoning:
        'Les notifications officielles requièrent un examen juridique préalable avant tout traitement.',
    },
    PARTNERSHIP_PROPOSAL: {
      role: 'CHEF_SOUSDIR_ETRANGER',
      reasoning:
        'Les propositions de partenariat (notamment internationales) relèvent de la Sous-Direction Promotion à l\'Étranger.',
    },
    REPORT: {
      role: 'CHEF_DIV_SUIVI',
      reasoning: 'Les rapports périodiques sont consolidés par la Division Suivi-Évaluation.',
    },
  };
  const fallback = byNature[doc.nature] ?? {
    role: 'DGA' as StaffRole,
    reasoning:
      'Document non classé automatiquement — le DGA répartira manuellement vers l\'unité la plus appropriée.',
  };

  return {
    summary: `[Mode démo · stub] ${doc.subject}. Une analyse réelle nécessite la clé ANTHROPIC_API_KEY sur le serveur (cf. shared/.env.production).`,
    suggestedRole: fallback.role,
    reasoning: fallback.reasoning,
    confidence: 'low',
    alternatives: [],
  };
}

// Expose roleLabel from here for the UI (avoids client-side roleMeta lookup overhead)
export async function roleLabelServer(role: StaffRole): Promise<string> {
  return roleLabel(role);
}
