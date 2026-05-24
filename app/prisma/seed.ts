/**
 * Seed — single admin/admin user for A1.
 * Run: npx prisma db seed (uses tsx via package.json)
 */
import { PrismaClient, UserType, StaffRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding…');

  const passwordHash = await bcrypt.hash('admin', 10);

  await db.user.upsert({
    where: { email: 'admin@api.cm' },
    update: { passwordHash },
    create: {
      email: 'admin@api.cm',
      passwordHash,
      name: 'Administrateur',
      userType: UserType.STAFF,
      staffRole: StaffRole.ADMIN,
      emailVerified: new Date(),
    },
  });

  console.log('✅ admin/admin user ready · email admin@api.cm');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
