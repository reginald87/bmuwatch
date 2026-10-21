/**
 * PRODUCTION bootstrap seed.
 *
 * Unlike the dev seed (prisma/seed.ts) this script:
 *   - creates admins from environment variables (never hard-coded passwords),
 *   - creates NO sample/demo reports,
 *   - only seeds the reference data (categories + locations) that reports need.
 *
 * It is idempotent: running it again re-applies the password/role from the
 * environment, which is how you rotate an admin password on a live server.
 *
 * Required env vars:
 *   ADMIN_EMAIL, ADMIN_PASSWORD   (super admin)
 * Optional:
 *   ADMIN_NAME                    (default: "System Administrator")
 *   CSO_EMAIL, CSO_PASSWORD, CSO_NAME
 *   OFFICER_EMAIL, OFFICER_PASSWORD, OFFICER_NAME
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORY_NAMES, LOCATION_NAMES } from "./reference-data";
const prisma = new PrismaClient();

type Role = "SUPER_ADMIN" | "CSO" | "SECURITY_OFFICER";

interface AdminSpec {
  name: string;
  email: string;
  password: string;
  role: Role;
}

function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return v;
}

function collectSpecs(): AdminSpec[] {
  const specs: AdminSpec[] = [
    {
      name: (process.env.ADMIN_NAME ?? "").trim() || "System Administrator",
      email: requireEnv("ADMIN_EMAIL").toLowerCase(),
      password: requireEnv("ADMIN_PASSWORD"),
      role: "SUPER_ADMIN"
    }
  ];

  const csoEmail = (process.env.CSO_EMAIL ?? "").trim();
  const csoPassword = (process.env.CSO_PASSWORD ?? "").trim();
  if (csoEmail || csoPassword) {
    if (!csoEmail || !csoPassword) {
      console.error("Set both CSO_EMAIL and CSO_PASSWORD (or neither).");
      process.exit(1);
    }
    specs.push({
      name: (process.env.CSO_NAME ?? "").trim() || "Chief Security Officer",
      email: csoEmail.toLowerCase(),
      password: csoPassword,
      role: "CSO"
    });
  }

  const officerEmail = (process.env.OFFICER_EMAIL ?? "").trim();
  const officerPassword = (process.env.OFFICER_PASSWORD ?? "").trim();
  if (officerEmail || officerPassword) {
    if (!officerEmail || !officerPassword) {
      console.error("Set both OFFICER_EMAIL and OFFICER_PASSWORD (or neither).");
      process.exit(1);
    }
    specs.push({
      name: (process.env.OFFICER_NAME ?? "").trim() || "Security Officer",
      email: officerEmail.toLowerCase(),
      password: officerPassword,
      role: "SECURITY_OFFICER"
    });
  }

  for (const s of specs) {
    if (s.password.length < 12) {
      console.error(`Password for ${s.email} is too short (minimum 12 characters).`);
      process.exit(1);
    }
  }

  return specs;
}

async function main() {
  console.log("Seeding BMU WATCH production data...");

  const specs = collectSpecs();

  for (const spec of specs) {
    await prisma.adminUser.upsert({
      where: { email: spec.email },
      update: {
        name: spec.name,
        role: spec.role,
        isActive: true,
        passwordHash: await bcrypt.hash(spec.password, 12)
      },
      create: {
        name: spec.name,
        email: spec.email,
        role: spec.role,
        passwordHash: await bcrypt.hash(spec.password, 12)
      }
    });
    console.log(`  admin ready: ${spec.email} (${spec.role})`);
  }

  for (let i = 0; i < CATEGORY_NAMES.length; i++) {
    await prisma.securityCategory.upsert({
      where: { name: CATEGORY_NAMES[i] },
      update: { sortOrder: i },
      create: { name: CATEGORY_NAMES[i], sortOrder: i }
    });
  }
  console.log(`  categories: ${CATEGORY_NAMES.length}`);

  for (let i = 0; i < LOCATION_NAMES.length; i++) {
    await prisma.securityLocation.upsert({
      where: { name: LOCATION_NAMES[i] },
      update: { sortOrder: i },
      create: { name: LOCATION_NAMES[i], sortOrder: i }
    });
  }
  console.log(`  locations: ${LOCATION_NAMES.length}`);

  const reportCount = await prisma.securityReport.count();
  console.log(`  reports in database: ${reportCount}`);

  console.log("Production seed complete.");
  console.log("--------------------------------------------------");
  for (const s of specs) {
    console.log(`  ${s.role}: ${s.email}`);
  }
  console.log("Change these passwords after the first sign-in.");
  console.log("--------------------------------------------------");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
