import { PrismaClient } from "@prisma/client";

// Prisma client singleton to avoid exhausting database connections in dev
// when Next.js hot-reloads modules.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
