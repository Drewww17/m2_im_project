const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = 'manager';
  const password = 'admin123';
  const hash = await bcrypt.hash(password, 12);

  await prisma.users.upsert({
    where: { username },
    update: {
      password_hash: hash,
      full_name: 'System Manager',
      role: 'MANAGER',
      is_active: true,
      updated_at: new Date(),
    },
    create: {
      username,
      password_hash: hash,
      full_name: 'System Manager',
      role: 'MANAGER',
      is_active: true,
      updated_at: new Date(),
    },
  });

  console.log('READY -> username: manager  password: admin123');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
