import type { Prisma, StaffRole } from '@prisma/client';
import { notFound } from 'next/navigation';
import { db } from './db';
import { descendantRoles, isStaffRole } from './roles';

// =============================================================================
//  VISIBILITY MODEL — single source of truth (B20)
//
//  Rule:
//    A staff member sees a document iff ANY is true:
//      1. The doc is/was assigned to my role (or any subordinate role).
//      2. The doc was handed off FROM my role (or subordinate).
//      3. The doc was sent for external avis by my role (or subordinate).
//      4. The doc's CURRENT holder is my role (or subordinate).
//
//  Visibility is ROLE-SCOPED (peers in the same role slot share the view).
//  Asymmetric: a Director sees subordinates' files; subordinates do NOT see
//  the Director's solo files.
//
//  Privileged roles bypass the scope filter:
//    - ADMIN                — operations
//    - DG / DGA             — apex of the org (descendants alone would cover
//                             everything; the bypass is just an optimisation)
//    - SECRETARIAT_DG       — monitoring the DG's queue is their job; they
//                             have no organigramme descendants on their own
//    - CHEF_SERVICE_COURRIER — cross-cutting mail-service monitoring
//
//  Every other role gets [self + transitive descendants] as their scope.
// =============================================================================

/** Roles that bypass the scope filter (visibility = everything). */
const FULL_VISIBILITY: ReadonlySet<StaffRole> = new Set<StaffRole>([
  'ADMIN',
  'DG',
  'DGA',
  'SECRETARIAT_DG',
  'CHEF_SERVICE_COURRIER',
]);

export type StaffScope = {
  /** True when the user bypasses scope filtering entirely (sees everything). */
  hasFullVisibility: boolean;
  /** The user's own role. */
  selfRole: StaffRole;
  /** The user's own id. */
  selfUserId: string;
  /**
   * Roles the user can see: their own role + every descendant role in the
   * organigramme. Empty array when `hasFullVisibility` is true (means "all").
   */
  roleScope: StaffRole[];
};

/**
 * Loose accept of the Auth.js Session shape — module augmentation in
 * `src/types/next-auth.d.ts` widens `user.role` to `string | undefined`,
 * so we widen here and validate via `isStaffRole` inside the function.
 */
type SessionLike =
  | { user?: { id?: string | null; role?: string | null } | null }
  | null
  | undefined;

/**
 * Build a scope object from the auth session. Returns `null` when the
 * session has no staff identity (or the role string isn't a valid
 * StaffRole) — the caller should redirect to /login.
 */
export function getStaffScope(session: SessionLike): StaffScope | null {
  const userId = session?.user?.id;
  const rawRole = session?.user?.role;
  if (!userId || !rawRole || !isStaffRole(rawRole)) return null;
  const role: StaffRole = rawRole;
  const hasFullVisibility = FULL_VISIBILITY.has(role);
  return {
    hasFullVisibility,
    selfRole: role,
    selfUserId: userId,
    roleScope: hasFullVisibility ? [] : [role, ...descendantRoles(role)],
  };
}

/**
 * Prisma where-clause that restricts Document queries to the user's scope.
 *
 *   const where = { ...documentVisibleWhere(scope), status: 'IN_TREATMENT' };
 *   const docs = await db.document.findMany({ where });
 *
 * Returns `{}` (no restriction) for users with `hasFullVisibility`.
 */
export function documentVisibleWhere(
  scope: StaffScope,
): Prisma.DocumentWhereInput {
  if (scope.hasFullVisibility) return {};
  const roles = scope.roleScope;
  return {
    OR: [
      { currentHolderRole: { in: roles } },
      { assignments: { some: { assignedToRole: { in: roles } } } },
      { handoffs: { some: { fromRole: { in: roles } } } },
      {
        externalTransmissions: {
          some: { sentBy: { staffRole: { in: roles } } },
        },
      },
    ],
  };
}

/**
 * Boolean check for a single document. Useful inside server actions or for
 * tests. Detail pages should prefer `assertCanAccessDocument()` so the user
 * gets a clean 404 when the doc is out of scope.
 */
export async function canAccessDocument(
  documentId: string,
  scope: StaffScope,
): Promise<boolean> {
  if (scope.hasFullVisibility) return true;
  const hit = await db.document.findFirst({
    where: { id: documentId, ...documentVisibleWhere(scope) },
    select: { id: true },
  });
  return Boolean(hit);
}

/**
 * Guard for server-component pages: throws Next.js `notFound()` (→ standard
 * 404 UI) when the document is out of scope. Doesn't reveal whether the
 * document exists — out-of-scope and unknown-id give the same response.
 *
 *   const session = await auth();
 *   const scope = getStaffScope(session);
 *   if (!scope) redirect('/login');
 *   await assertCanAccessDocument(id, scope);
 *   // safe to load the document below
 */
export async function assertCanAccessDocument(
  documentId: string,
  scope: StaffScope,
): Promise<void> {
  if (await canAccessDocument(documentId, scope)) return;
  notFound();
}
