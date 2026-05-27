import type { StaffRole } from '@prisma/client';

/**
 * Single source of truth for the 37 organigramme roles.
 * Aligned with Résolution du Conseil d'Administration · 02 juillet 2020.
 */

export type RoleGroup =
  | 'DIRECTION_GENERALE'
  | 'AUPRES_DG'
  | 'SD_COMMUNICATION'
  | 'CELLULE_TRADUCTION'
  | 'SD_AFFAIRES_GENERALES'
  | 'AFFAIRES_JURIDIQUES'
  | 'SERVICE_COURRIER'
  | 'DIRECTION_PROMOTION'
  | 'DIRECTION_FACILITATION'
  | 'DIVISION_SUIVI'
  | 'ANTENNES'
  | 'ADMINISTRATION_SYSTEME';

export const ROLE_GROUP_LABEL_FR: Record<RoleGroup, string> = {
  DIRECTION_GENERALE:     'Direction Générale',
  AUPRES_DG:              'Auprès du DG',
  SD_COMMUNICATION:       'Sous-direction Communication & RP',
  CELLULE_TRADUCTION:     'Cellule Traduction & Bilinguisme',
  SD_AFFAIRES_GENERALES:  'Sous-direction Affaires Générales',
  AFFAIRES_JURIDIQUES:    'Affaires Juridiques',
  SERVICE_COURRIER:       'Service du Courrier',
  DIRECTION_PROMOTION:    'Direction de la Promotion des Investissements',
  DIRECTION_FACILITATION: 'Direction Facilitation, Assistance & Coopération',
  DIVISION_SUIVI:         'Division Suivi-Évaluation & Stratégie',
  ANTENNES:               'Antennes Régionales',
  ADMINISTRATION_SYSTEME: 'Administration système',
};

export const ROLE_GROUP_LABEL_EN: Record<RoleGroup, string> = {
  DIRECTION_GENERALE:     'General Management',
  AUPRES_DG:              'GM Office',
  SD_COMMUNICATION:       'Communications & PR Sub-Department',
  CELLULE_TRADUCTION:     'Translation & Bilingualism Cell',
  SD_AFFAIRES_GENERALES:  'General Affairs Sub-Department',
  AFFAIRES_JURIDIQUES:    'Legal Affairs',
  SERVICE_COURRIER:       'Mail Service',
  DIRECTION_PROMOTION:    'Investment Promotion Department',
  DIRECTION_FACILITATION: 'Facilitation, Assistance & Cooperation Department',
  DIVISION_SUIVI:         'Monitoring, Evaluation & Strategy Division',
  ANTENNES:               'Regional Offices',
  ADMINISTRATION_SYSTEME: 'System Administration',
};

type RoleMeta = {
  role: StaffRole;
  group: RoleGroup;
  fr: string;          // full French title
  en: string;          // full English title
  shortFr: string;
  article: string;     // ref to article of the Résolution
  parent?: StaffRole;  // immediate supervisor
};

export const ROLES: RoleMeta[] = [
  // --- Direction Générale
  { role: 'DG',  group: 'DIRECTION_GENERALE', fr: 'Directeur Général',           en: 'General Manager',          shortFr: 'DG',  article: 'Art. 1' },
  { role: 'DGA', group: 'DIRECTION_GENERALE', fr: 'Directeur Général Adjoint',   en: 'Deputy General Manager',   shortFr: 'DGA', article: 'Art. 1', parent: 'DG' },

  // --- Auprès du DG
  { role: 'ATTACHE',          group: 'AUPRES_DG', fr: 'Attaché',           en: 'Attaché',            shortFr: 'Attaché',          article: 'Art. 3', parent: 'DG' },
  { role: 'AUDITEUR_INTERNE', group: 'AUPRES_DG', fr: 'Auditeur Interne',  en: 'Internal Auditor',   shortFr: 'Auditeur Interne', article: 'Art. 4', parent: 'DG' },
  { role: 'SECRETARIAT_DG',   group: 'AUPRES_DG', fr: 'Secrétariat du DG', en: 'DG Secretariat',     shortFr: 'Secrétariat DG',   article: '—',      parent: 'DG' },

  // --- Sous-direction Communication
  { role: 'CHEF_SOUSDIR_COMM', group: 'SD_COMMUNICATION', fr: 'Sous-directeur de la Communication & RP', en: 'Head of Communications & PR Sub-Dept', shortFr: 'SD Communication', article: 'Art. 5', parent: 'DG' },
  { role: 'CHEF_SERVICE_COMM', group: 'SD_COMMUNICATION', fr: 'Chef du Service de la Communication',     en: 'Head of Communication Service',        shortFr: 'Service Communication', article: 'Art. 6', parent: 'CHEF_SOUSDIR_COMM' },
  { role: 'CHEF_SERVICE_RP',   group: 'SD_COMMUNICATION', fr: 'Chef du Service des Relations Publiques & Protocole', en: 'Head of Public Relations & Protocol', shortFr: 'Service RP & Protocole', article: 'Art. 7', parent: 'CHEF_SOUSDIR_COMM' },

  // --- Cellule Traduction
  { role: 'CHEF_CELL_TRAD', group: 'CELLULE_TRADUCTION', fr: 'Chef de la Cellule Traduction & Promotion du Bilinguisme', en: 'Head of Translation & Bilingualism Cell', shortFr: 'Cellule Traduction', article: 'Art. 8', parent: 'DG' },

  // --- Sous-direction Affaires Générales
  { role: 'CHEF_SOUSDIR_AG',     group: 'SD_AFFAIRES_GENERALES', fr: 'Sous-directeur des Affaires Générales',          en: 'Head of General Affairs Sub-Dept',        shortFr: 'SD Affaires Générales', article: 'Art. 9',  parent: 'DG' },
  { role: 'CHEF_SERVICE_SAF',    group: 'SD_AFFAIRES_GENERALES', fr: 'Chef du Service Administratif & Financier',     en: 'Head of Admin & Finance Service',         shortFr: 'SAF',                   article: 'Art. 10', parent: 'CHEF_SOUSDIR_AG' },
  { role: 'CHEF_SERVICE_RH',     group: 'SD_AFFAIRES_GENERALES', fr: 'Chef du Service des Ressources Humaines',       en: 'Head of HR Service',                       shortFr: 'RH',                     article: 'Art. 11', parent: 'CHEF_SOUSDIR_AG' },
  { role: 'CHEF_SERVICE_INFO',   group: 'SD_AFFAIRES_GENERALES', fr: 'Chef du Service Informatique & Multimédia',     en: 'Head of IT & Multimedia Service',          shortFr: 'Informatique',           article: 'Art. 12', parent: 'CHEF_SOUSDIR_AG' },
  { role: 'CHEF_SERVICE_MATERIEL', group: 'SD_AFFAIRES_GENERALES', fr: 'Chef du Service du Matériel & Comptabilité-Matières', en: 'Head of Materials & Inventory Service', shortFr: 'Matériel',          article: 'Art. 13', parent: 'CHEF_SOUSDIR_AG' },

  // --- Affaires Juridiques
  { role: 'CHEF_SERVICE_JUR', group: 'AFFAIRES_JURIDIQUES', fr: 'Chef du Service des Affaires Juridiques', en: 'Head of Legal Affairs', shortFr: 'Affaires Juridiques', article: 'Art. 14', parent: 'DG' },

  // --- Service du Courrier
  { role: 'CHEF_SERVICE_COURRIER', group: 'SERVICE_COURRIER', fr: 'Chef du Service du Courrier',     en: 'Head of Mail Service',              shortFr: 'Service Courrier',    article: 'Art. 15', parent: 'DG' },
  { role: 'CHEF_BUREAU_ARRIVEE',   group: 'SERVICE_COURRIER', fr: 'Chef du Bureau Courrier Arrivée', en: 'Head of Incoming Mail Office',      shortFr: 'Bureau Arrivée',      article: 'Art. 16', parent: 'CHEF_SERVICE_COURRIER' },
  { role: 'CHEF_BUREAU_DEPART',    group: 'SERVICE_COURRIER', fr: 'Chef du Bureau Courrier Départ',  en: 'Head of Outgoing Mail Office',      shortFr: 'Bureau Départ',       article: 'Art. 17', parent: 'CHEF_SERVICE_COURRIER' },
  { role: 'CHEF_BUREAU_ARCHIVES',  group: 'SERVICE_COURRIER', fr: 'Chef du Bureau des Archives',     en: 'Head of Archives',                   shortFr: 'Bureau Archives',     article: 'Art. 18', parent: 'CHEF_SERVICE_COURRIER' },

  // --- Direction de la Promotion
  { role: 'DIR_PROMOTION',           group: 'DIRECTION_PROMOTION', fr: 'Directeur de la Promotion des Investissements',  en: 'Investment Promotion Director',  shortFr: 'Dir. Promotion',          article: 'Art. 20', parent: 'DG' },
  { role: 'CHEF_SOUSDIR_LOCALE',     group: 'DIRECTION_PROMOTION', fr: 'Sous-directeur de la Promotion Locale',           en: 'Head of Local Promotion',         shortFr: 'SD Promotion Locale',     article: 'Art. 21', parent: 'DIR_PROMOTION' },
  { role: 'CHEF_SERVICE_PRIMAIRE',   group: 'DIRECTION_PROMOTION', fr: 'Chef du Service Promotion Secteur Primaire',      en: 'Head of Primary Sector Promotion', shortFr: 'Service Primaire',        article: 'Art. 22', parent: 'CHEF_SOUSDIR_LOCALE' },
  { role: 'CHEF_SERVICE_SECONDAIRE', group: 'DIRECTION_PROMOTION', fr: 'Chef du Service Promotion Secteur Secondaire',    en: 'Head of Secondary Sector Promotion', shortFr: 'Service Secondaire',    article: 'Art. 23', parent: 'CHEF_SOUSDIR_LOCALE' },
  { role: 'CHEF_SERVICE_TERTIAIRE',  group: 'DIRECTION_PROMOTION', fr: 'Chef du Service Promotion Secteur Tertiaire',     en: 'Head of Tertiary Sector Promotion',  shortFr: 'Service Tertiaire',     article: 'Art. 24', parent: 'CHEF_SOUSDIR_LOCALE' },
  { role: 'CHEF_SOUSDIR_ETRANGER',   group: 'DIRECTION_PROMOTION', fr: 'Sous-directeur de la Promotion à l\'Étranger',    en: 'Head of Foreign Promotion',           shortFr: 'SD Promotion Étranger',   article: 'Art. 25', parent: 'DIR_PROMOTION' },
  { role: 'CHEF_SERVICE_EUROPE',     group: 'DIRECTION_PROMOTION', fr: 'Chef du Service Promotion Zone Europe',          en: 'Head of Europe Zone Promotion',       shortFr: 'Zone Europe',             article: 'Art. 26', parent: 'CHEF_SOUSDIR_ETRANGER' },
  { role: 'CHEF_SERVICE_AMERIQUE',   group: 'DIRECTION_PROMOTION', fr: 'Chef du Service Promotion Zone Amérique',         en: 'Head of Americas Zone Promotion',     shortFr: 'Zone Amérique',           article: 'Art. 27', parent: 'CHEF_SOUSDIR_ETRANGER' },
  { role: 'CHEF_SERVICE_MOAP',       group: 'DIRECTION_PROMOTION', fr: 'Chef du Service Promotion Zone Moyen-Orient · Asie · Pacifique', en: 'Head of MEAP Zone Promotion', shortFr: 'Zone MOAP',           article: 'Art. 28', parent: 'CHEF_SOUSDIR_ETRANGER' },
  { role: 'CHEF_SERVICE_AFRIQUE',    group: 'DIRECTION_PROMOTION', fr: 'Chef du Service Promotion Zone Afrique',          en: 'Head of Africa Zone Promotion',        shortFr: 'Zone Afrique',            article: 'Art. 29', parent: 'CHEF_SOUSDIR_ETRANGER' },

  // --- Direction Facilitation
  { role: 'DIR_FACILITATION',         group: 'DIRECTION_FACILITATION', fr: 'Directeur de la Facilitation, Assistance & Coopération', en: 'Facilitation, Assistance & Cooperation Director', shortFr: 'Dir. Facilitation',     article: 'Art. 30', parent: 'DG' },
  { role: 'CHEF_SOUSDIR_FACILITATION', group: 'DIRECTION_FACILITATION', fr: 'Sous-directeur de la Facilitation',                       en: 'Head of Facilitation Sub-Dept',                    shortFr: 'SD Facilitation',       article: 'Art. 31', parent: 'DIR_FACILITATION' },
  { role: 'CHEF_SERVICE_ACCUEIL',     group: 'DIRECTION_FACILITATION', fr: 'Chef du Service de l\'Accueil & de l\'Assistance',         en: 'Head of Welcome & Assistance',                      shortFr: 'Accueil & Assistance', article: 'Art. 32', parent: 'CHEF_SOUSDIR_FACILITATION' },
  { role: 'CHEF_SERVICE_AGREMENTS',   group: 'DIRECTION_FACILITATION', fr: 'Chef du Service des Agréments',                            en: 'Head of Approvals Service',                          shortFr: 'Agréments',           article: 'Art. 33', parent: 'CHEF_SOUSDIR_FACILITATION' },
  { role: 'CHEF_SOUSDIR_COOPERATION', group: 'DIRECTION_FACILITATION', fr: 'Sous-directeur de la Coopération',                         en: 'Head of Cooperation Sub-Dept',                       shortFr: 'SD Coopération',       article: 'Art. 34', parent: 'DIR_FACILITATION' },
  { role: 'CHEF_SERVICE_BILATERALE',  group: 'DIRECTION_FACILITATION', fr: 'Chef du Service de la Coopération Bilatérale',             en: 'Head of Bilateral Cooperation',                       shortFr: 'Bilatérale',          article: 'Art. 35', parent: 'CHEF_SOUSDIR_COOPERATION' },
  { role: 'CHEF_SERVICE_MULTILATERALE', group: 'DIRECTION_FACILITATION', fr: 'Chef du Service de la Coopération Multilatérale',       en: 'Head of Multilateral Cooperation',                    shortFr: 'Multilatérale',       article: 'Art. 36', parent: 'CHEF_SOUSDIR_COOPERATION' },

  // --- Division Suivi-Évaluation
  { role: 'CHEF_DIV_SUIVI',       group: 'DIVISION_SUIVI', fr: 'Chef de la Division Suivi-Évaluation & Stratégie', en: 'Head of Monitoring, Evaluation & Strategy Division', shortFr: 'Div. Suivi-Évaluation', article: 'Art. 37', parent: 'DG' },
  { role: 'CHEF_CELL_SUIVI_EVAL', group: 'DIVISION_SUIVI', fr: 'Chef de la Cellule du Suivi-Évaluation',           en: 'Head of Monitoring & Evaluation Cell',              shortFr: 'Cellule Suivi-Éval',     article: 'Art. 38', parent: 'CHEF_DIV_SUIVI' },
  { role: 'CHEF_CELL_STRATEGIE',  group: 'DIVISION_SUIVI', fr: 'Chef de la Cellule de la Stratégie',              en: 'Head of Strategy Cell',                              shortFr: 'Cellule Stratégie',     article: 'Art. 39', parent: 'CHEF_DIV_SUIVI' },

  // --- Antennes
  { role: 'CHEF_ANTENNE', group: 'ANTENNES', fr: 'Chef d\'Antenne Régionale', en: 'Head of Regional Office', shortFr: 'Chef d\'Antenne', article: 'Art. 41', parent: 'DG' },

  // --- Admin
  { role: 'ADMIN', group: 'ADMINISTRATION_SYSTEME', fr: 'Administrateur', en: 'System Administrator', shortFr: 'Administrateur', article: '—' },
];

// ---- Look-ups ----

const ROLE_BY_ENUM = new Map(ROLES.map((r) => [r.role, r]));

export function roleMeta(role: StaffRole | null | undefined): RoleMeta | undefined {
  if (!role) return undefined;
  return ROLE_BY_ENUM.get(role);
}

export function roleLabel(role: StaffRole | null | undefined, locale: 'fr' | 'en' = 'fr'): string {
  const m = roleMeta(role);
  if (!m) return '—';
  return locale === 'en' ? m.en : m.fr;
}

export function roleShort(role: StaffRole | null | undefined): string {
  return roleMeta(role)?.shortFr ?? '—';
}

export function roleParent(role: StaffRole): StaffRole | undefined {
  return roleMeta(role)?.parent;
}

export function roleAncestors(role: StaffRole): StaffRole[] {
  const out: StaffRole[] = [];
  let cur: StaffRole | undefined = roleParent(role);
  while (cur) {
    out.push(cur);
    cur = roleParent(cur);
  }
  return out;
}

export function roleChildren(role: StaffRole): StaffRole[] {
  return ROLES.filter((r) => r.parent === role).map((r) => r.role);
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && ROLE_BY_ENUM.has(value as StaffRole);
}

/** Grouped list for selects/pickers. */
export function rolesGrouped(): { group: RoleGroup; label: string; roles: RoleMeta[] }[] {
  const groups = Object.keys(ROLE_GROUP_LABEL_FR) as RoleGroup[];
  return groups.map((g) => ({
    group: g,
    label: ROLE_GROUP_LABEL_FR[g],
    roles: ROLES.filter((r) => r.group === g),
  }));
}
