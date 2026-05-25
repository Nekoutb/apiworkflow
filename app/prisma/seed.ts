/**
 * Seed — v2 schema · document-centric workflow · B2 expansion
 *
 * Provisions one ACTIVE staff account per organigramme role (37 total) plus
 * an extra "admin" account for the ADMIN slot. All passwords default to
 * "admin" (per project rule, replaced at B26 onboarding).
 *
 * Also seeds 4 antennes (per R3 decision: Littoral, Centre, Ouest, Adamaoua)
 * and links the CHEF_ANTENNE seed user to Antenne Littoral so the existing
 * "antenne.littoral" shortcut keeps working.
 *
 * Idempotent — re-running just upserts and never wipes existing data.
 * The sample document at the bottom is only created if missing.
 */
import {
  PrismaClient,
  UserType,
  StaffRole,
  SourceChannel,
  DocumentNature,
  DocumentStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

// ---------------------------------------------------------------------------
// Antennes — R3 launch list
// ---------------------------------------------------------------------------
const ANTENNES = [
  { name: 'Antenne Littoral',  region: 'Littoral',  ville: 'Douala',     address: 'Bonanjo, immeuble API Littoral' },
  { name: 'Antenne Centre',    region: 'Centre',    ville: 'Yaoundé',    address: 'Bastos, immeuble API Centre' },
  { name: 'Antenne Ouest',     region: 'Ouest',     ville: 'Bafoussam',  address: 'Tougang, immeuble API Ouest' },
  { name: 'Antenne Adamaoua',  region: 'Adamaoua',  ville: 'Ngaoundéré', address: 'Centre-ville, immeuble API Adamaoua' },
];

// ---------------------------------------------------------------------------
// Staff — one user per role.
//   - shortName (used to build email) is the login shortcut typed at /login
//   - "admin" + "antenne.littoral" + "dg" + "arrivee" + "depart" preserved
//     so the existing dev shortcuts continue to work
// ---------------------------------------------------------------------------
type SeedStaff = { shortName: string; fullName: string; role: StaffRole };

const STAFF: SeedStaff[] = [
  // Admin sentinel
  { shortName: 'admin', fullName: 'Administrateur', role: 'ADMIN' },

  // Direction Générale
  { shortName: 'dg',         fullName: 'Dr. Pierre Eyenga',     role: 'DG' },
  { shortName: 'dga',        fullName: 'Marie-Ange Mbarga',     role: 'DGA' },

  // Auprès du DG
  { shortName: 'attache',     fullName: 'Jean Mboma',           role: 'ATTACHE' },
  { shortName: 'auditeur',    fullName: 'Sandrine Onana',       role: 'AUDITEUR_INTERNE' },

  // Sous-direction Communication
  { shortName: 'sd.comm',     fullName: 'Edith Nkoa',           role: 'CHEF_SOUSDIR_COMM' },
  { shortName: 'comm',        fullName: 'Achille Foumane',      role: 'CHEF_SERVICE_COMM' },
  { shortName: 'rp',          fullName: 'Aline Tchamba',        role: 'CHEF_SERVICE_RP' },

  // Cellule Traduction
  { shortName: 'traduction',  fullName: 'Cécile Bekolo',        role: 'CHEF_CELL_TRAD' },

  // Sous-direction Affaires Générales
  { shortName: 'sd.ag',       fullName: 'Roger Mvondo',         role: 'CHEF_SOUSDIR_AG' },
  { shortName: 'saf',         fullName: 'Suzanne Atangana',     role: 'CHEF_SERVICE_SAF' },
  { shortName: 'rh',          fullName: 'Yvonne Manga',         role: 'CHEF_SERVICE_RH' },
  { shortName: 'informatique', fullName: 'Hervé Owona',         role: 'CHEF_SERVICE_INFO' },
  { shortName: 'materiel',    fullName: 'Léon Etoga',           role: 'CHEF_SERVICE_MATERIEL' },

  // Affaires Juridiques
  { shortName: 'juridique',   fullName: 'Me. Bernard Kuete',    role: 'CHEF_SERVICE_JUR' },

  // Service du Courrier
  { shortName: 'courrier',    fullName: 'Vincent Awoumou',      role: 'CHEF_SERVICE_COURRIER' },
  { shortName: 'arrivee',     fullName: 'Marie Etoundi',        role: 'CHEF_BUREAU_ARRIVEE' },
  { shortName: 'depart',      fullName: 'Paul Nkomo',           role: 'CHEF_BUREAU_DEPART' },
  { shortName: 'archives',    fullName: 'Joséphine Mpondo',     role: 'CHEF_BUREAU_ARCHIVES' },

  // Direction de la Promotion
  { shortName: 'dir.promotion', fullName: 'Dr. Claude Nsangou', role: 'DIR_PROMOTION' },
  { shortName: 'sd.locale',    fullName: 'Estelle Bilongo',     role: 'CHEF_SOUSDIR_LOCALE' },
  { shortName: 'primaire',     fullName: 'Bertrand Tabi',        role: 'CHEF_SERVICE_PRIMAIRE' },
  { shortName: 'secondaire',   fullName: 'Hilaire Sone',         role: 'CHEF_SERVICE_SECONDAIRE' },
  { shortName: 'tertiaire',    fullName: 'Pauline Mefiro',       role: 'CHEF_SERVICE_TERTIAIRE' },
  { shortName: 'sd.etranger',  fullName: 'Olivier Tjeega',       role: 'CHEF_SOUSDIR_ETRANGER' },
  { shortName: 'europe',       fullName: 'Élise Nguelé',         role: 'CHEF_SERVICE_EUROPE' },
  { shortName: 'amerique',     fullName: 'Roméo Bilé',           role: 'CHEF_SERVICE_AMERIQUE' },
  { shortName: 'moap',         fullName: 'Florence Kemajou',     role: 'CHEF_SERVICE_MOAP' },
  { shortName: 'afrique',      fullName: 'Casimir Belibi',       role: 'CHEF_SERVICE_AFRIQUE' },

  // Direction Facilitation
  { shortName: 'dir.facilitation', fullName: 'Antoinette Yene',  role: 'DIR_FACILITATION' },
  { shortName: 'sd.facilitation',  fullName: 'Gilles Atangana',  role: 'CHEF_SOUSDIR_FACILITATION' },
  { shortName: 'accueil',         fullName: 'Béatrice Eboué',    role: 'CHEF_SERVICE_ACCUEIL' },
  { shortName: 'agrements',       fullName: 'Léopold Tchana',    role: 'CHEF_SERVICE_AGREMENTS' },
  { shortName: 'sd.cooperation',  fullName: 'Jacqueline Tene',   role: 'CHEF_SOUSDIR_COOPERATION' },
  { shortName: 'bilaterale',      fullName: 'Honoré Eboubé',     role: 'CHEF_SERVICE_BILATERALE' },
  { shortName: 'multilaterale',   fullName: 'Aurore Manga',      role: 'CHEF_SERVICE_MULTILATERALE' },

  // Division Suivi-Évaluation
  { shortName: 'div.suivi',       fullName: 'Christian Mballa',  role: 'CHEF_DIV_SUIVI' },
  { shortName: 'suivi.eval',      fullName: 'Adèle Ndo',         role: 'CHEF_CELL_SUIVI_EVAL' },
  { shortName: 'strategie',       fullName: 'Pascal Mendomo',    role: 'CHEF_CELL_STRATEGIE' },

  // Antennes
  { shortName: 'antenne.littoral', fullName: 'Hervé Bissek',     role: 'CHEF_ANTENNE' },
];

async function main() {
  console.log('🌱 Seeding API Cameroun · v2 · B2 (37 rôles, 4 antennes)\n');

  const passwordHash = await bcrypt.hash('admin', 10);

  // ---- Antennes ---------------------------------------------------------
  const antenneByName = new Map<string, { id: string }>();
  for (const a of ANTENNES) {
    const row = await db.antenne.upsert({
      where: { name: a.name },
      update: { region: a.region, ville: a.ville, address: a.address, active: true },
      create: { ...a, active: true },
    });
    antenneByName.set(a.name, { id: row.id });
    console.log(`   ✓ Antenne · ${a.name}`);
  }
  const littoralId = antenneByName.get('Antenne Littoral')!.id;

  // ---- Staff ------------------------------------------------------------
  console.log('\nPersonnel:');
  let chefAntenneUserId: string | null = null;

  for (const u of STAFF) {
    const email = `${u.shortName}@api.cm`;
    const isChefAntenne = u.role === 'CHEF_ANTENNE';
    const user = await db.user.upsert({
      where: { email },
      update: {
        passwordHash,
        name: u.fullName,
        userType: UserType.STAFF,
        staffRole: u.role,
        status: 'ACTIVE',
        antenneId: isChefAntenne ? littoralId : null,
      },
      create: {
        email,
        passwordHash,
        name: u.fullName,
        userType: UserType.STAFF,
        staffRole: u.role,
        emailVerified: new Date(),
        antenneId: isChefAntenne ? littoralId : null,
      },
    });
    if (isChefAntenne) chefAntenneUserId = user.id;
    console.log(`   ✓ ${email.padEnd(34)} ${u.role}`);
  }

  // Tie Antenne Littoral chefUserId
  if (chefAntenneUserId) {
    await db.antenne.update({
      where: { id: littoralId },
      data: { chefUserId: chefAntenneUserId },
    });
  }

  // ---- Sample document (idempotent — only if missing) -------------------
  const existing = await db.document.findUnique({
    where: { reference: 'COURRIER-2026-000001' },
  });
  if (!existing) {
    const sampleDoc = await db.document.create({
      data: {
        reference: 'COURRIER-2026-000001',
        subject: "Demande d'agrément · Projet Centrale Solaire 50 MW",
        nature: DocumentNature.AGREMENT_REQUEST,
        status: DocumentStatus.AWAITING_DG_ANALYSIS,
        sourceChannel: SourceChannel.ONLINE,
        submittedAt: hoursAgo(2),
        acknowledgedAt: hoursAgo(2),
        submission: {
          create: {
            senderName: 'Aïcha Bouba',
            senderEmail: 'contact@solarcm.cm',
            senderOrganization: 'Cameroun Solar Power SA',
            senderPhone: '+237 6 55 44 33 22',
            senderType: 'Investisseur',
            submittedVia: SourceChannel.ONLINE,
            registeredAt: hoursAgo(2),
            acknowledgementSentAt: hoursAgo(2),
            acknowledgementCode: 'COURRIER-2026-000001',
          },
        },
        versions: {
          create: {
            kind: 'ORIGINAL',
            fileName: 'demande-agrement-solar.pdf',
            storageUri: 'seed://demande-agrement-solar.pdf',
            sha256: 'a'.repeat(64),
            sizeBytes: 482_300,
            mimeType: 'application/pdf',
          },
        },
      },
    });
    const arriveeUser = await db.user.findUnique({ where: { email: 'arrivee@api.cm' } });
    await db.handoff.create({
      data: {
        documentId: sampleDoc.id,
        type: 'COURRIER_TO_DG',
        fromRole: 'CHEF_BUREAU_ARRIVEE',
        fromUserId: arriveeUser?.id ?? null,
        toRole: 'DG',
        reason: 'Document reçu en ligne · transmis pour analyse DG.',
      },
    });
    console.log(`\nDocuments:\n   ✓ ${sampleDoc.reference} · ${sampleDoc.subject}`);
  } else {
    console.log('\nDocuments:\n   = COURRIER-2026-000001 already present (left as-is)');
  }

  console.log(`\n✅ Done. ${STAFF.length} staff users · ${ANTENNES.length} antennes`);
  console.log('   Mot de passe universel : admin');
  console.log('   Identifiants courts ex.: admin · dg · arrivee · sd.comm · dir.facilitation');
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
