import "fake-indexeddb/auto";

// Point the Prisma client at the isolated test database so tests never touch
// the development DB. Prisma resolves the MySQL server from the connection
// string, so this targets a dedicated MySQL database.
process.env.DATABASE_URL = "mysql://bmuwatch:bmuwatch@localhost:3306/bmuwatch_test";
process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-testing";

// Import after setting env so the Prisma singleton binds to the test DB.
import { prisma } from "./lib/db";

afterAll(async () => {
  await prisma.$disconnect();
});
