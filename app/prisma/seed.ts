/**
 * Seed — build-mode users (admin/admin everywhere).
 *
 * Creates one admin + one user per staff role so the workflow can be exercised
 * end-to-end during construction.  All passwords are `admin`.
 *
 * Run: npx prisma db seed
 */
import { PrismaClient, UserType, StaffRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

type SeedUser = {
  email: string;
  name: string;
  role: StaffRole;
};

const USERS: SeedUser[] = [
  { email: 'admin@api.cm',       name: 'Administrateur',     role: 'ADMIN' },
  { email: 'secretariat@api.cm', name: 'Marie Etoundi',      role: 'SECRETARY' },
  { email: 'investissements@api.cm', name: 'Paul Nkomo',     role: 'DIR_INVESTMENTS' },
  { email: 'conformite@api.cm',  name: 'Jeanne Mballa',      role: 'DIR_COMPLIANCE' },
  { email: 'exterieur@api.cm',   name: 'Christine Abena',    role: 'DIR_EXTERNAL' },
  { email: 'dg@api.cm',          name: 'Dr. Pierre Eyenga',  role: 'DG' },
];

async function main() {
  console.log('🌱 Seeding API Cameroun build-mode users…');

  const passwordHash = await bcrypt.hash('admin', 10);

  for (const u of USERS) {
    await db.user.upsert({
      where: { email: u.email },
      update: {
        passwordHash,
        name: u.name,
        userType: UserType.STAFF,
        staffRole: u.role,
        status: 'ACTIVE',
      },
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

  console.log('\n✅ Done. All accounts use password: admin');
  console.log('   Shortcut: typing "admin" as email resolves to admin@api.cm.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
