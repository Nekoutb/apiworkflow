/**
 * Constants + types for the admin user-management surface.
 * Kept outside `lib/actions/users.ts` because that file is a 'use server'
 * module and may only export async functions.
 */

export type CreateStaffState =
  | { status: 'idle' }
  | { status: 'error'; error: string; values?: { name?: string; email?: string; role?: string; phone?: string } }
  | { status: 'success'; email: string; emailMode: 'sent' | 'logged' | 'error' };

export const initialCreateStaffState: CreateStaffState = { status: 'idle' };
