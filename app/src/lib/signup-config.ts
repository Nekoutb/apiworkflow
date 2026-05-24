/**
 * Plain config & types for the investor sign-up flow.
 *
 * Lives in its own file so the 'use client' SignupForm can import constants
 * without crossing the 'use server' boundary (which would crash at runtime).
 */

export const SIGNUP_LEGAL_FORMS = [
  'SARL', 'SA', 'SUARL', 'GIE', 'Société de personnes', 'Autre',
] as const;

export const SIGNUP_REGIONS = [
  'Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral',
  'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest',
] as const;

export type SignupValues = {
  raisonSociale?: string;
  contactName?: string;
  email?: string;
  niu?: string;
  legalForm?: string;
  region?: string;
  city?: string;
  contactPhone?: string;
};

export type SignupState =
  | { status: 'idle' }
  | { status: 'error'; error: string; values?: SignupValues };

export const initialSignupState: SignupState = { status: 'idle' };
