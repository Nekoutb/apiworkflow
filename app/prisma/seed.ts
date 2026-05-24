/**
 * Seed — build-mode users + 3 sample conventions in mixed workflow states.
 *
 * Users: 1 admin + 5 staff (one per role) + 3 investors.
 * Password is always `admin`.  Login accepts the local-part shortcut
 * (typing "secretariat" auto-maps to secretariat@api.cm).
 *
 * Sample conventions:
 *   - CV-2026-000001 · TechCam SARL · DRAFT (investor still uploading)
 *   - CV-2026-000002 · AgroVert SA · SUBMITTED · stage DIR_COMPLIANCE
 *   - CV-2026-000003 · Cameroun Solar Power · SIGNED by DG
 */
import {
  PrismaClient,
  UserType,
  StaffRole,
  Sector,
  Category,
  ConventionStatus,
  ConventionStage,
  WorkflowAction,
  DocumentKind,
  VerificationState,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

type SeedStaff = { email: string; name: string; role: StaffRole };

const STAFF: SeedStaff[] = [
  { email: 'admin@api.cm',           name: 'Administrateur',    role: 'ADMIN' },
  { email: 'secretariat@api.cm',     name: 'Marie Etoundi',     role: 'SECRETARY' },
  { email: 'investissements@api.cm', name: 'Paul Nkomo',        role: 'DIR_INVESTMENTS' },
  { email: 'conformite@api.cm',      name: 'Jeanne Mballa',     role: 'DIR_COMPLIANCE' },
  { email: 'exterieur@api.cm',       name: 'Christine Abena',   role: 'DIR_EXTERNAL' },
  { email: 'dg@api.cm',              name: 'Dr. Pierre Eyenga', role: 'DG' },
];

type SeedInvestor = {
  email: string;
  name: string;
  raisonSociale: string;
  niu: string;
  legalForm: string;
  region: string;
  city: string;
  contactName: string;
  contactPhone: string;
  isExisting?: boolean;
};

const INVESTORS: SeedInvestor[] = [
  {
    email: 'contact@techcam.cm',
    name: 'Mireille Tagne',
    raisonSociale: 'TechCam SARL',
    niu: 'M021412345678P',
    legalForm: 'SARL',
    region: 'Centre',
    city: 'Yaoundé',
    contactName: 'Mireille Tagne',
    contactPhone: '+237 6 77 12 34 56',
  },
  {
    email: 'contact@agrovert.cm',
    name: 'Hervé Bissek',
    raisonSociale: 'AgroVert SA',
    niu: 'M021498765432A',
    legalForm: 'SA',
    region: 'Littoral',
    city: 'Douala',
    contactName: 'Hervé Bissek',
    contactPhone: '+237 6 99 88 77 66',
  },
  {
    email: 'contact@solarcm.cm',
    name: 'Aïcha Bouba',
    raisonSociale: 'Cameroun Solar Power',
    niu: 'M021455667788S',
    legalForm: 'SA',
    region: 'Nord',
    city: 'Garoua',
    contactName: 'Aïcha Bouba',
    contactPhone: '+237 6 55 44 33 22',
    isExisting: true,
  },
];

function categoryFor(amount: bigint): Category {
  if (amount < 1_000_000_000n) return 'A';
  if (amount <= 5_000_000_000n) return 'B';
  return 'C';
}

async function main() {
  console.log('🌱 Seeding API Cameroun…\n');

  const passwordHash = await bcrypt.hash('admin', 10);

  // ---- Staff ----
  console.log('Personnel API:');
  for (const u of STAFF) {
    await db.user.upsert({
      where: { email: u.email },
      update: { passwordHash, name: u.name, userType: 'STAFF', staffRole: u.role, status: 'ACTIVE' },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        userType: UserType.STAFF,
        staffRole: u.role,
        emailVerified: new Date(),
      },
    });
    console.log(`   ✓ ${u.email.padEnd(28)} ${u.role}`);
  }

  // ---- Investors (User + Investor row) ----
  console.log('\nInvestisseurs:');
  const investorRecords = [];
  for (const i of INVESTORS) {
    const user = await db.user.upsert({
      where: { email: i.email },
      update: { passwordHash, name: i.name, userType: 'INVESTOR', status: 'ACTIVE' },
      create: {
        email: i.email,
        passwordHash,
        name: i.name,
        userType: UserType.INVESTOR,
        emailVerified: new Date(),
      },
    });

    const investor = await db.investor.upsert({
      where: { userId: user.id },
      update: {
        raisonSociale: i.raisonSociale,
        niu: i.niu,
        legalForm: i.legalForm,
        region: i.region,
        city: i.city,
        contactName: i.contactName,
        contactPhone: i.contactPhone,
        isExisting: i.isExisting ?? false,
      },
      create: {
        userId: user.id,
        raisonSociale: i.raisonSociale,
        niu: i.niu,
        legalForm: i.legalForm,
        region: i.region,
        city: i.city,
        contactName: i.contactName,
        contactPhone: i.contactPhone,
        isExisting: i.isExisting ?? false,
      },
    });
    investorRecords.push(investor);
    console.log(`   ✓ ${i.email.padEnd(28)} ${i.raisonSociale}${i.isExisting ? ' · existant' : ''}`);
  }

  const [techcam, agrovert, solar] = investorRecords;

  // ---- Wipe sample conventions so the seed is idempotent ----
  await db.convention.deleteMany({
    where: { reference: { in: ['CV-2026-000001', 'CV-2026-000002', 'CV-2026-000003'] } },
  });

  // ---- Sample convention 1: DRAFT (still being prepared) ----
  console.log('\nConventions:');
  const cv1Amount = 850_000_000n;
  const cv1 = await db.convention.create({
    data: {
      reference: 'CV-2026-000001',
      investorId: techcam.id,
      projectName: 'Hub data Centre Yaoundé',
      sector: Sector.NUMERIQUE,
      region: 'Centre',
      investmentFcfa: cv1Amount,
      jobsPlanned: 42,
      category: categoryFor(cv1Amount),
      status: ConventionStatus.DRAFT,
      currentStage: ConventionStage.SECRETARY,
    },
  });
  // 3 of 6 documents uploaded
  await db.document.createMany({
    data: [
      { conventionId: cv1.id, kind: DocumentKind.REGISTRATION,     fileName: 'rccm-techcam.pdf',           storageUri: 'seed://rccm-techcam.pdf',           sha256: 'a'.repeat(64), sizeBytes: 184_320, mimeType: 'application/pdf', verification: 'PENDING' },
      { conventionId: cv1.id, kind: DocumentKind.TAX_ID,           fileName: 'niu-techcam.pdf',            storageUri: 'seed://niu-techcam.pdf',            sha256: 'b'.repeat(64), sizeBytes:  98_750, mimeType: 'application/pdf', verification: 'PENDING' },
      { conventionId: cv1.id, kind: DocumentKind.COMPANY_STATUTES, fileName: 'statuts-techcam.pdf',        storageUri: 'seed://statuts-techcam.pdf',        sha256: 'c'.repeat(64), sizeBytes: 320_998, mimeType: 'application/pdf', verification: 'PENDING' },
    ],
  });
  console.log(`   ✓ ${cv1.reference} · TechCam SARL · DRAFT (3/6 docs)`);

  // ---- Sample convention 2: SUBMITTED · at DIR_COMPLIANCE ----
  const cv2Amount = 3_200_000_000n;
  const cv2 = await db.convention.create({
    data: {
      reference: 'CV-2026-000002',
      investorId: agrovert.id,
      projectName: 'Complexe agro-industriel Edéa',
      sector: Sector.AGRICULTURE,
      region: 'Littoral',
      investmentFcfa: cv2Amount,
      jobsPlanned: 187,
      category: categoryFor(cv2Amount),
      status: ConventionStatus.SUBMITTED,
      currentStage: ConventionStage.DIR_COMPLIANCE,
      submittedAt: daysAgo(11),
      recepisseNo: 'REC-2026-000002',
      financialSummary: {
        create: {
          totalInvestmentFcfa: cv2Amount,
          equityFcfa:  1_500_000_000n,
          debtFcfa:    1_700_000_000n,
          capexFcfa:   2_800_000_000n,
          opexYearOneFcfa: 420_000_000n,
          expectedRevenueFcfa: 1_900_000_000n,
          paybackMonths: 52,
          jobsDirect: 187,
          jobsIndirect: 240,
        },
      },
    },
  });
  // All 6 mandatory docs accepted
  const cv2DocKinds: DocumentKind[] = [
    'REGISTRATION', 'TAX_ID', 'NON_REDEVANCE', 'COMPANY_STATUTES', 'FEASIBILITY_STUDY', 'FINANCING_PROOF',
  ];
  await db.document.createMany({
    data: cv2DocKinds.map((kind, idx) => ({
      conventionId: cv2.id,
      kind,
      fileName: `${kind.toLowerCase()}-agrovert.pdf`,
      storageUri: `seed://${kind.toLowerCase()}-agrovert.pdf`,
      sha256: String.fromCharCode(97 + idx).repeat(64),
      sizeBytes: 200_000 + idx * 25_000,
      mimeType: 'application/pdf',
      verification: VerificationState.ACCEPTED,
      verifiedAt: daysAgo(10),
    })),
  });
  // Workflow trace: received & handed off twice, currently at DIR_COMPLIANCE awaiting signoff
  await db.workflowEvent.createMany({
    data: [
      { conventionId: cv2.id, stage: 'SECRETARY',       action: 'RECEIVED',   createdAt: daysAgo(11) },
      { conventionId: cv2.id, stage: 'SECRETARY',       action: 'SIGNED_OFF', comment: 'Dossier complet · 6/6 documents conformes', createdAt: daysAgo(9) },
      { conventionId: cv2.id, stage: 'SECRETARY',       action: 'HANDED_OFF', createdAt: daysAgo(9) },
      { conventionId: cv2.id, stage: 'DIR_INVESTMENTS', action: 'RECEIVED',   createdAt: daysAgo(9) },
      { conventionId: cv2.id, stage: 'DIR_INVESTMENTS', action: 'SIGNED_OFF', comment: 'Projet conforme à l\'article 7 · avis favorable', createdAt: daysAgo(5) },
      { conventionId: cv2.id, stage: 'DIR_INVESTMENTS', action: 'HANDED_OFF', createdAt: daysAgo(5) },
      { conventionId: cv2.id, stage: 'DIR_COMPLIANCE',  action: 'RECEIVED',   createdAt: daysAgo(5) },
    ],
  });
  console.log(`   ✓ ${cv2.reference} · AgroVert SA · SUBMITTED · stage DIR_COMPLIANCE (J+5)`);

  // ---- Sample convention 3: SIGNED ----
  const cv3Amount = 12_000_000_000n;
  const dg = await db.user.findUnique({ where: { email: 'dg@api.cm' } });
  const cv3 = await db.convention.create({
    data: {
      reference: 'CV-2026-000003',
      investorId: solar.id,
      projectName: 'Centrale solaire 50 MW · Maroua',
      sector: Sector.ENERGIE,
      region: 'Extrême-Nord',
      investmentFcfa: cv3Amount,
      jobsPlanned: 312,
      category: categoryFor(cv3Amount),
      status: ConventionStatus.SIGNED,
      currentStage: ConventionStage.DG,
      submittedAt: daysAgo(45),
      signedAt: daysAgo(3),
      signerUserId: dg?.id,
      recepisseNo: 'REC-2026-000003',
      agreementNo: 'CV-2026-000003',
    },
  });
  await db.workflowEvent.createMany({
    data: [
      { conventionId: cv3.id, stage: 'SECRETARY',       action: 'RECEIVED',   createdAt: daysAgo(45) },
      { conventionId: cv3.id, stage: 'SECRETARY',       action: 'SIGNED_OFF', createdAt: daysAgo(40), comment: '6/6 documents conformes' },
      { conventionId: cv3.id, stage: 'SECRETARY',       action: 'HANDED_OFF', createdAt: daysAgo(40) },
      { conventionId: cv3.id, stage: 'DIR_INVESTMENTS', action: 'RECEIVED',   createdAt: daysAgo(40) },
      { conventionId: cv3.id, stage: 'DIR_INVESTMENTS', action: 'SIGNED_OFF', createdAt: daysAgo(32), comment: 'Conformité Art. 7 · favorable' },
      { conventionId: cv3.id, stage: 'DIR_INVESTMENTS', action: 'HANDED_OFF', createdAt: daysAgo(32) },
      { conventionId: cv3.id, stage: 'DIR_COMPLIANCE',  action: 'RECEIVED',   createdAt: daysAgo(32) },
      { conventionId: cv3.id, stage: 'DIR_COMPLIANCE',  action: 'SIGNED_OFF', createdAt: daysAgo(22), comment: 'Conformité au fond · favorable' },
      { conventionId: cv3.id, stage: 'DIR_COMPLIANCE',  action: 'HANDED_OFF', createdAt: daysAgo(22) },
      { conventionId: cv3.id, stage: 'DIR_EXTERNAL',    action: 'RECEIVED',   createdAt: daysAgo(22) },
      { conventionId: cv3.id, stage: 'DIR_EXTERNAL',    action: 'SIGNED_OFF', createdAt: daysAgo(12), comment: 'Réglementations externes · favorable' },
      { conventionId: cv3.id, stage: 'DIR_EXTERNAL',    action: 'HANDED_OFF', createdAt: daysAgo(12) },
      { conventionId: cv3.id, stage: 'DG',              action: 'RECEIVED',   createdAt: daysAgo(12) },
      { conventionId: cv3.id, stage: 'DG',              action: 'SIGNED_OFF', actorUserId: dg?.id ?? undefined, createdAt: daysAgo(3), comment: 'Convention signée · agrément délivré' },
    ],
  });
  console.log(`   ✓ ${cv3.reference} · Cameroun Solar Power · SIGNED par DG`);

  console.log('\n✅ Done. All accounts use password: admin');
  console.log('   Login shortcut: "admin", "secretariat", "dg"… auto-appends @api.cm');
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
