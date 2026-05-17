/**
 * Seed script for local development and demo environments.
 *
 * Run: npx prisma db seed
 *
 * Creates: 1 admin, 1 of each staff role, 3 investor accounts with dossiers,
 * a handful of ZDP localities and 2026 public holidays.
 */
import { PrismaClient, StaffRole, UserType, Regime, ProjectType, Sector, Category, DossierState } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding…');

  const hashedPwd = await bcrypt.hash('demo-1234', 10);

  // --- Staff users (one per role) ---
  const staffSeed: Array<{ email: string; name: string; role: StaffRole }> = [
    { email: 'marie.etoundi@api.cm',   name: 'Marie Etoundi',     role: StaffRole.RECEPTION },
    { email: 'paul.nkomo@api.cm',      name: 'Paul Nkomo',        role: StaffRole.INSTRUCTION },
    { email: 'jeanne.mballa@dgi.cm',   name: 'Jeanne Mballa',     role: StaffRole.TAX },
    { email: 'samuel.ngono@dgd.cm',    name: 'Samuel Ngono',      role: StaffRole.CUSTOMS },
    { email: 'christine.abena@api.cm', name: 'Christine Abena',   role: StaffRole.CHEF_GU },
    { email: 'pierre.eyenga@api.cm',   name: 'Dr. Pierre Eyenga', role: StaffRole.DG },
    { email: 'admin@api.cm',           name: 'Admin Système',     role: StaffRole.ADMIN },
  ];
  for (const s of staffSeed) {
    await db.user.upsert({
      where: { email: s.email },
      update: {},
      create: {
        email: s.email,
        passwordHash: hashedPwd,
        name: s.name,
        userType: UserType.STAFF,
        staffRole: s.role,
        emailVerified: new Date(),
      },
    });
  }
  console.log(`✅ ${staffSeed.length} staff users`);

  // --- Investor users + profiles + a draft dossier each ---
  const investorSeed = [
    { email: 'e.tchoua@agrocam.cm',     name: 'Eric Tchoua',     company: 'SARL AGRO-CAM',           niu: 'M042312891234B' },
    { email: 'f.kameni@camindustrie.com', name: 'Florence Kameni', company: 'SA CAMINDUSTRIE',       niu: 'M021987654321A' },
    { email: 'p.mbarga@dcdouala.cm',    name: 'Patrick Mbarga',  company: 'DATA-CENTER DOUALA SUARL', niu: 'M050246813579C' },
  ];
  for (const inv of investorSeed) {
    const user = await db.user.upsert({
      where: { email: inv.email },
      update: {},
      create: {
        email: inv.email,
        passwordHash: hashedPwd,
        name: inv.name,
        userType: UserType.INVESTOR,
        emailVerified: new Date(),
      },
    });
    await db.investorProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        raisonSociale: inv.company,
        niu: inv.niu,
        legalForm: inv.company.includes('SA ') ? 'SA' : inv.company.includes('SUARL') ? 'SUARL' : 'SARL',
        country: 'Cameroun',
        kycStatus: 'VERIFIED',
      },
    });
  }
  console.log(`✅ ${investorSeed.length} investor users + profiles`);

  // --- ZDP localities ---
  const zdps = [
    { name: 'Région du Nord', region: 'Nord' },
    { name: 'Région de l\'Extrême-Nord', region: 'Extrême-Nord' },
    { name: 'Région de l\'Adamaoua', region: 'Adamaoua' },
    { name: 'Région du Sud-Ouest', region: 'Sud-Ouest' },
    { name: 'Région du Nord-Ouest', region: 'Nord-Ouest' },
    { name: 'Région de l\'Est', region: 'Est' },
  ];
  for (const z of zdps) {
    await db.zdpLocality.upsert({
      where: { name: z.name },
      update: {},
      create: z,
    });
  }
  console.log(`✅ ${zdps.length} ZDP localities`);

  // --- 2026 Cameroon public holidays (subset for SLA engine) ---
  const holidays = [
    { date: new Date('2026-01-01'), label: 'Jour de l\'an' },
    { date: new Date('2026-02-11'), label: 'Fête nationale de la jeunesse' },
    { date: new Date('2026-04-03'), label: 'Vendredi saint' },
    { date: new Date('2026-05-01'), label: 'Fête du travail' },
    { date: new Date('2026-05-20'), label: 'Fête nationale' },
    { date: new Date('2026-08-15'), label: 'Assomption' },
    { date: new Date('2026-12-25'), label: 'Noël' },
  ];
  for (const h of holidays) {
    await db.businessHoliday.upsert({
      where: { date: h.date },
      update: {},
      create: h,
    });
  }
  console.log(`✅ ${holidays.length} 2026 public holidays`);

  console.log('🌱 Seed complete.');
  console.log('');
  console.log('Demo logins (password for all: demo-1234):');
  console.log('  Staff: marie.etoundi@api.cm (Réception), paul.nkomo@api.cm (Instruction), etc.');
  console.log('  Investors: e.tchoua@agrocam.cm, f.kameni@camindustrie.com, p.mbarga@dcdouala.cm');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
