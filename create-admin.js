const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 10);

  await prisma.users.create({
    data: {
      username: "manager",
      password_hash: hashedPassword,
      full_name: "System Manager",
      role: "MANAGER",
    },
  });

  console.log("Manager account created!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
