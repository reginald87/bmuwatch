import "fake-indexeddb/auto";

// Point the Prisma client at the isolated test database so tests never touch
// the development DB. Prisma resolves `file:` URLs relative to the schema dir,
// so this targets prisma/test.db.
process.env.DATABASE_URL = "file:./test.db";
process.env.AUTH_SECRET = "test-secret-that-is-long-enough-for-testing";

// Import after setting env so the Prisma singleton binds to the test DB.
import { prisma } from "./lib/db";

afterAll(async () => {
  await prisma.$disconnect();
});
