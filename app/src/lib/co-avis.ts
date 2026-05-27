import type { StaffRole, HandoffType } from '@prisma/client';
import { roleParent } from './roles';

// ============================================================================
//  Co-avis (HORIZONTAL handoff) bookkeeping helpers (B13).
//
//  A "co-avis" is when a Directeur-level role asks a peer Directeur for an
//  opinion on a document. The request is a HORIZONTAL handoff; the response
//  is another HORIZONTAL handoff in the opposite direction.
//
//  Multiple co-avis can be nested (DIR_A → DIR_B → DIR_C, then unwound back
//  in reverse). We pair them with a stack: each new request pushes; a
//  matching return (where to/from match the top of the stack reversed) pops.
//  The contents of the stack at any time are the currently OPEN co-avis
//  requests for this document, in chronological order.
//
//  These helpers are pure functions over Handoff data — usable from server
//  components, server actions, and (if needed) client components alike.
// ============================================================================

export type HandoffLike = {
  type: HandoffType;
  fromRole: StaffRole | null;
  toRole: StaffRole | null;
  createdAt: Date;
};

/**
 * Returns the still-open HORIZONTAL handoffs (in chronological order) after
 * pairing requests with their matching returns. The most recently opened
 * request is at the end of the array.
 */
export function openCoAvisRequests(handoffs: HandoffLike[]): HandoffLike[] {
  const sorted = [...handoffs].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  const stack: HandoffLike[] = [];
  for (const h of sorted) {
    if (h.type !== 'HORIZONTAL') continue;
    const top = stack[stack.length - 1];
    if (
      top &&
      top.toRole === h.fromRole &&
      top.fromRole === h.toRole
    ) {
      // matching return — pop the previously opened request
      stack.pop();
    } else {
      stack.push(h);
    }
  }
  return stack;
}

/**
 * If `forRole` is currently holding the document as the target of an open
 * co-avis request, returns the role that originally asked. Otherwise null.
 *
 * Uses the most recent open request that targets `forRole` (correctly
 * handles nesting: each role only sees the immediate requester, not the
 * original chain root).
 */
export function coAvisReturnTarget(
  handoffs: HandoffLike[],
  forRole: StaffRole,
): StaffRole | null {
  const open = openCoAvisRequests(handoffs);
  for (let i = open.length - 1; i >= 0; i--) {
    if (open[i].toRole === forRole) {
      return open[i].fromRole;
    }
  }
  return null;
}

/**
 * Returns true if `role` is a "Directeur-level peer" — i.e., reports
 * directly to DG. This is the set of roles allowed to send / receive
 * HORIZONTAL co-avis.
 *
 * (We deliberately exclude DG and DGA themselves — they don't ask peers
 * for co-avis; they make decisions.)
 */
export function isDirectorPeer(role: StaffRole): boolean {
  if (role === 'DG' || role === 'DGA' || role === 'ADMIN') return false;
  return roleParent(role) === 'DG';
}

/**
 * Returns the list of peer Directeur roles for `role` — every other role
 * that reports directly to DG. Empty if `role` is not a Directeur peer.
 *
 * Excludes self, DG, DGA, and ADMIN.
 */
export function directorPeers(role: StaffRole, allRoles: StaffRole[]): StaffRole[] {
  if (!isDirectorPeer(role)) return [];
  return allRoles.filter(
    (r) => r !== role && isDirectorPeer(r),
  );
}
