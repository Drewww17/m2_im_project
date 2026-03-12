/**
 * Prisma Client Singleton
 * Prevents multiple instances during development hot reload
 */
import { PrismaClient } from '../generated/prisma';

const globalForPrisma = globalThis;
const requiredDelegates = ['sales', 'business_days'];

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    transactionOptions: {
      maxWait: 10000,
      timeout: 30000,
    },
  });
}

function hasRequiredDelegates(client) {
  return requiredDelegates.every((delegate) => typeof client?.[delegate] !== 'undefined');
}

if (process.env.NODE_ENV !== 'production' && globalForPrisma.prisma && !hasRequiredDelegates(globalForPrisma.prisma)) {
  globalForPrisma.prisma.$disconnect().catch(() => {});
  globalForPrisma.prisma = undefined;
}

const prisma = hasRequiredDelegates(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
