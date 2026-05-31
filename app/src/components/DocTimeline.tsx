import { roleLabel } from '@/lib/roles';
import type { StaffRole } from '@prisma/client';

/**
 * Merged "Historique + Notes" timeline for the document detail pages.
 *
 * Handoffs (the chain-of-custody transfers) and Comments (free-text notes)
 * are interleaved into a single chronological list. Notes are NOT FK-linked
 * to a specific handoff in the schema — they only carry a timestamp — so we
 * place each note in time order and indent it (gold marker) so it visually
 * reads as "the note that accompanies the handoff just above it".
 *
 * Used by /unit/parapheur/[id], /dg/parapheur/[id], /courrier/depart/[id].
 */

export type TimelineHandoff = {
  id: string;
  type: string;
  fromRole: StaffRole | null;
  toRole: StaffRole | null;
  reason: string | null;
  createdAt: Date;
};

export type TimelineComment = {
  id: string;
  body: string;
  createdAt: Date;
  authorRole: StaffRole | null;
  author: { name: string | null; email: string | null } | null;
};

type Item =
  | { kind: 'handoff'; at: Date; idx: number; h: TimelineHandoff }
  | { kind: 'note'; at: Date; c: TimelineComment };

export function DocTimeline({
  handoffs,
  comments,
  locale,
  isEn,
}: {
  handoffs: TimelineHandoff[];
  comments: TimelineComment[];
  locale: 'fr' | 'en';
  isEn: boolean;
}) {
  const dtLocale = isEn ? 'en-GB' : 'fr-FR';
  const dtShort: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' };

  // Build the merged, time-sorted list. Handoffs keep a 1-based step index.
  const items: Item[] = [
    ...handoffs.map((h, i) => ({ kind: 'handoff' as const, at: h.createdAt, idx: i + 1, h })),
    ...comments.map((c) => ({ kind: 'note' as const, at: c.createdAt, c })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  if (items.length === 0) {
    return (
      <p className="text-[12.5px] italic text-ink-3">
        {isEn ? 'No activity yet.' : 'Aucune activité pour le moment.'}
      </p>
    );
  }

  const noteAuthor = (c: TimelineComment) =>
    c.author?.name ??
    c.author?.email ??
    (c.authorRole ? roleLabel(c.authorRole, locale) : isEn ? 'System' : 'Système');

  return (
    <ol className="space-y-3">
      {items.map((it) =>
        it.kind === 'handoff' ? (
          <li key={`h-${it.h.id}`} className="border-l-2 border-cmgreen-700 pl-3">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-cmgreen-900">
                {it.idx}. {it.h.type}
              </div>
              <div className="text-[10.5px] text-ink-4">
                {it.h.createdAt.toLocaleString(dtLocale, dtShort)}
              </div>
            </div>
            <div className="mt-1 text-[11.5px] text-ink-3">
              {it.h.fromRole ? roleLabel(it.h.fromRole, locale) : '—'} →{' '}
              {it.h.toRole ? roleLabel(it.h.toRole, locale) : '—'}
            </div>
            {it.h.reason && (
              <p className="serif mt-1 text-[12px] italic text-ink-2">{it.h.reason}</p>
            )}
          </li>
        ) : (
          // Note — indented under whatever precedes it, gold marker, "note" tag
          <li key={`c-${it.c.id}`} className="ml-4 border-l-2 border-gold-600 bg-gold-50/40 px-3 py-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
              <span className="font-bold uppercase tracking-[0.1em] text-gold-700">
                {isEn ? 'Note' : 'Note'} · {noteAuthor(it.c)}
              </span>
              <span className="text-ink-4">
                {it.c.createdAt.toLocaleString(dtLocale, dtShort)}
              </span>
            </div>
            <p className="serif mt-1 whitespace-pre-wrap text-[12.5px] text-ink-2">{it.c.body}</p>
          </li>
        ),
      )}
    </ol>
  );
}
