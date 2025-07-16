import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed UserTypes
  const userTypes = [
    'USER_GUEST',
    'USER',
    'USER_WORKER',
    'USER_SYSTEM',
    'USER_ADMIN',
  ];

  // Upsert UserTypes and collect their records
  const userTypeRecords: Awaited<ReturnType<typeof prisma.userType.upsert>>[] =
    [];
  for (const name of userTypes) {
    const userType = await prisma.userType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    userTypeRecords.push(userType);
  }

  console.log('✅ Seeded UserTypes');
  for (const userType of userTypeRecords) {
    await prisma.user.upsert({
      where: { email: `${userType.name.toLowerCase()}@example.com` },
      update: {},
      create: {
        name: `${userType.name} User`,
        email: `${userType.name.toLowerCase()}@example.com`,
        password: 'password123', // In production, use hashed passwords!
        usertype_id: userType.id,
      },
    });
  }

  console.log('✅ Seeded Users for each UserType');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
