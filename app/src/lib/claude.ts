/**
 * Thin wrapper around the Anthropic SDK.
 *
 * Graceful fallback: when ANTHROPIC_API_KEY is missing we return a
 * deterministic stub so the rest of the app keeps working without an
 * API key.  The UI surfaces a "mode démo" badge in that case.
 */

import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5';

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  return _client;
}

export type ClaudeJsonResult<T> = {
  ok: true;
  data: T;
  mode: 'live' | 'stub';
  tokensIn?: number;
  tokensOut?: number;
} | {
  ok: false;
  error: string;
  mode: 'live' | 'stub';
};

/**
 * Ask Claude to produce a JSON object that conforms to the caller's shape.
 *
 * Stub mode: returns the supplied `stubFactory()` so callers can develop
 * the rest of the surface without an API key.
 */
export async function generateJson<T>(args: {
  system: string;
  user: string;
  maxTokens?: number;
  stubFactory: () => T;
}): Promise<ClaudeJsonResult<T>> {
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
    if (!data) return { ok: false, error: 'Réponse Claude non parsable', mode: 'live' };

    return {
      ok: true,
      data,
      mode: 'live',
      tokensIn: msg.usage.input_tokens,
      tokensOut: msg.usage.output_tokens,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { ok: false, error: msg, mode: 'live' };
  }
}

/**
 * Send a PDF (or image) + a JSON-shaped prompt to Claude and parse the
 * structured response. Used by B4 to OCR an incoming courrier and extract
 * sender / subject / nature fields + a 50-word synopsis.
 *
 * `file` is the raw bytes; `mimeType` should be the file's reported mime
 * type (application/pdf, image/png, image/jpeg, image/webp).
 *
 * Returns ClaudeJsonResult<T>. In stub mode (no API key) returns the
 * stub factory result so the rest of the UI flow keeps working.
 */
export async function analyzeDocument<T>(args: {
  system: string;
  user: string;
  file: Buffer;
  mimeType: string;
  maxTokens?: number;
  stubFactory: () => T;
}): Promise<ClaudeJsonResult<T>> {
  if (!isClaudeConfigured()) {
    return { ok: true, data: args.stubFactory(), mode: 'stub' };
  }

  // Claude vision/document API accepts base64-encoded files inline
  const base64 = args.file.toString('base64');
  const isPdf = args.mimeType === 'application/pdf';

  try {
    const msg = await client().messages.create({
      model: CLAUDE_MODEL,
      max_tokens: args.maxTokens ?? 2048,
      system:
        args.system +
        '\n\nRESPONSE FORMAT: return only a valid JSON object, no prose, no markdown fences.',
      messages: [
        {
          role: 'user',
          content: [
            isPdf
              ? {
                  type: 'document',
                  source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: base64,
                  },
                }
              : {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: args.mimeType as
                      | 'image/jpeg'
                      | 'image/png'
                      | 'image/gif'
                      | 'image/webp',
                    data: base64,
                  },
                },
            { type: 'text', text: args.user },
          ],
        },
      ],
    });

    const text = msg.content
      .filter((c) => c.type === 'text')
      .map((c) => (c.type === 'text' ? c.text : ''))
      .join('\n');

    const data = parseJsonBlob<T>(text);
    if (!data) {
      return { ok: false, error: 'Réponse Claude non parsable', mode: 'live' };
    }

    return {
      ok: true,
      data,
      mode: 'live',
      tokensIn: msg.usage.input_tokens,
      tokensOut: msg.usage.output_tokens,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    return { ok: false, error: msg, mode: 'live' };
  }
}

function parseJsonBlob<T>(text: string): T | null {
  const trimmed = text.trim();
  // Try direct parse first
  try { return JSON.parse(trimmed) as T; } catch { /* fall through */ }
  // Fenced ```json ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenced) {
    try { return JSON.parse(fenced[1]) as T; } catch { /* fall through */ }
  }
  // First {...} block
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last !== -1) {
    try { return JSON.parse(trimmed.slice(first, last + 1)) as T; } catch { /* fall through */ }
  }
  return null;
}
