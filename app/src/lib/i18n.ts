/**
 * Minimal i18n shell — FR primary, EN secondary.
 * Replace with next-intl or paraglide in Phase 1 if richer features needed.
 */

export type Locale = 'fr' | 'en';

export const SUPPORTED_LOCALES: Locale[] = ['fr', 'en'];
export const DEFAULT_LOCALE: Locale = 'fr';

type Dict = Record<string, string>;

const fr: Dict = {
  'common.signin': 'Se connecter',
  'common.signup': 'Créer un compte',
  'common.signout': 'Se déconnecter',
  'common.back': 'Retour',
  'common.cancel': 'Annuler',
  'common.submit': 'Soumettre',
  'common.save': 'Enregistrer',
  'common.next': 'Suivant',
  'common.previous': 'Précédent',
  'common.email': 'Adresse email',
  'common.password': 'Mot de passe',
  'common.dashboard': 'Tableau de bord',
  'common.documents': 'Documents',
  'common.status': 'Statut',
  'common.messages': 'Messages',
  'common.search': 'Rechercher',
  'common.loading': 'Chargement…',
  'app.name': 'API Cameroun',
  'app.title': 'Portail des Investissements',
  'app.subtitle': 'République du Cameroun',
  'app.legal': "En application de l'Ordonnance n° 2025/002 du 18 juillet 2025",
};

const en: Dict = {
  'common.signin': 'Sign in',
  'common.signup': 'Create account',
  'common.signout': 'Sign out',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.submit': 'Submit',
  'common.save': 'Save',
  'common.next': 'Next',
  'common.previous': 'Previous',
  'common.email': 'Email address',
  'common.password': 'Password',
  'common.dashboard': 'Dashboard',
  'common.documents': 'Documents',
  'common.status': 'Status',
  'common.messages': 'Messages',
  'common.search': 'Search',
  'common.loading': 'Loading…',
  'app.name': 'API Cameroon',
  'app.title': 'Investment Portal',
  'app.subtitle': 'Republic of Cameroon',
  'app.legal': 'Pursuant to Ordinance n° 2025/002 of 18 July 2025',
};

const dicts: Record<Locale, Dict> = { fr, en };

export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
  return dicts[locale]?.[key] ?? dicts[DEFAULT_LOCALE][key] ?? key;
}
