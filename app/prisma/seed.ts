/**
 * Seed — v2 schema · document-centric workflow
 *
 * Provisions the minimal cast needed to exercise the new circuit:
 * - 1 admin (admin/admin shortcut)
 * - 1 DG  (apex of the organigramme)
 * - 1 Chef Bureau Arrivée (entry point)
 * - 1 Chef Bureau Départ (outbound)
 * - 1 Chef d'Antenne (1 sample antenna)
 * - 1 sample Document already received (visible on /admin/data)
 *
 * Larger seed (1 user per role) lands in B2.
 */
import { PrismaClient, UserType, StaffRole, SourceChannel, DocumentNature, DocumentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

type SeedStaff = { email: string; name: string; role: StaffRole };

const STAFF: SeedStaff[] = [
  { email: 'admin@api.cm',         name: 'Administrateur',        role: 'ADMIN' },
  { email: 'dg@api.cm',            name: 'Dr. Pierre Eyenga',     role: 'DG' },
  { email: 'arrivee@api.cm',       name: 'Marie Etoundi',         role: 'CHEF_BUREAU_ARRIVEE' },
  { email: 'depart@api.cm',        name: 'Paul Nkomo',            role: 'CHEF_BUREAU_DEPART' },
  { email: 'antenne.littoral@api.cm', name: 'Hervé Bissek',       role: 'CHEF_ANTENNE' },
];

async function main() {
  console.log('🌱 Seeding API Cameroun · v2 (document-centric)\n');

  const passwordHash = await bcrypt.hash('admin', 10);

  // ---- Antenna (Littoral) ----
  const antenne = await db.antenne.upsert({
    where: { name: 'Antenne Littoral' },
    update: {},
    create: {
      name: 'Antenne Littoral',
      region: 'Littoral',
      ville: 'Douala',
      address: 'Bonanjo, immeuble API Littoral',
      active: true,
    },
  });
  console.log(`   ✓ Antenne · ${antenne.name}`);

  // ---- Staff ----
  console.log('\nPersonnel:');
  let chefAntenneUserId: string | null = null;
  for (const u of STAFF) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        name: u.name,
        userType: UserType.STAFF,
        staffRole: u.role,
        status: 'ACTIVE',
        antenneId: u.role === 'CHEF_ANTENNE' ? antenne.id : null,
      },
      create: {
        email: u.email,
        passwordHash,
        name: u.name,
        userType: UserType.STAFF,
        staffRole: u.role,
        emailVerified: new Date(),
        antenneId: u.role === 'CHEF_ANTENNE' ? antenne.id : null,
      },
    });
    if (u.role === 'CHEF_ANTENNE') chefAntenneUserId = user.id;
    console.log(`   ✓ ${u.email.padEnd(32)} ${u.role}`);
  }

  // Tie the antenna's chefUserId
  if (chefAntenneUserId) {
    await db.antenne.update({
      where: { id: antenne.id },
      data: { chefUserId: chefAntenneUserId },
    });
  }

  // ---- Sample document (online submission) ----
  await db.document.deleteMany({ where: { reference: 'COURRIER-2026-000001' } });

  const sampleDoc = await db.document.create({
    data: {
      reference: 'COURRIER-2026-000001',
      subject: 'Demande d\'agrément · Projet Centrale Solaire 50 MW',
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

  // Initial handoff: Bureau Arrivée → DG
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

  console.log('\nDocuments:');
  console.log(`   ✓ ${sampleDoc.reference} · ${sampleDoc.subject}`);

  console.log('\n✅ Done. Mot de passe universel : admin');
  console.log('   Identifiants courts : admin · dg · arrivee · depart · antenne.littoral');
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
