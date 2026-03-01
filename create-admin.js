const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_FULL_NAME || 'System Manager';

  if (!username || !password) {
    throw new Error('Missing ADMIN_USERNAME or ADMIN_PASSWORD environment variables');
  }

  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long');
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.users.upsert({
    where: { username },
    update: {
      password_hash: hashedPassword,
      full_name: fullName,
      role: 'MANAGER',
      is_active: true,
      updated_at: new Date(),
    },
    create: {
      username,
      password_hash: hashedPassword,
      full_name: fullName,
      role: 'MANAGER',
      is_active: true,
      updated_at: new Date(),
    },
  });

  console.log(`Manager account upserted for user: ${username}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
