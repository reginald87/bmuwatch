import { PrismaClient, ReporterType, Urgency } from "@prisma/client";
import bcrypt from "bcryptjs";// Seed script for development only. NOT for production.
import { CATEGORY_NAMES, LOCATION_NAMES } from "./reference-data";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding BMU WATCH database...");

  // ------------------------------------------------------------------
  // Admin users (DEV ONLY credentials)
  // ------------------------------------------------------------------
  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? "superadmin@bmuwatch.dev";
  const superAdminPassword = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "SuperAdmin!12345";
  const csoEmail = process.env.SEED_CSO_EMAIL ?? "cso@bmuwatch.dev";
  const csoPassword = process.env.SEED_CSO_PASSWORD ?? "CsoAdmin!12345";
  const officerEmail = process.env.SEED_OFFICER_EMAIL ?? "officer@bmuwatch.dev";
  const officerPassword = process.env.SEED_OFFICER_PASSWORD ?? "Officer!12345";

  const superAdmin = await prisma.adminUser.upsert({
    where: { email: superAdminEmail },
    update: {},
    create: {
      name: "Super Admin",
      email: superAdminEmail,
      passwordHash: await bcrypt.hash(superAdminPassword, 12),
      role: "SUPER_ADMIN"
    }
  });

  const cso = await prisma.adminUser.upsert({
    where: { email: csoEmail },
    update: {},
    create: {
      name: "Chief Security Officer",
      email: csoEmail,
      passwordHash: await bcrypt.hash(csoPassword, 12),
      role: "CSO"
    }
  });

  const officer = await prisma.adminUser.upsert({
    where: { email: officerEmail },
    update: {},
    create: {
      name: "Security Officer A",
      email: officerEmail,
      passwordHash: await bcrypt.hash(officerPassword, 12),
      role: "SECURITY_OFFICER"
    }
  });

  // ------------------------------------------------------------------
  // Security categories
  // ------------------------------------------------------------------
  const categories = CATEGORY_NAMES;

  const categoryRecords: Record<string, { id: string }> = {};
  for (let i = 0; i < categories.length; i++) {
    const rec = await prisma.securityCategory.upsert({
      where: { name: categories[i] },
      update: {},
      create: { name: categories[i], sortOrder: i, description: null }
    });
    categoryRecords[categories[i]] = rec;
  }

  // ------------------------------------------------------------------
  // Security locations
  // ------------------------------------------------------------------
  const locations = LOCATION_NAMES;

  const locationRecords: Record<string, { id: string }> = {};
  for (let i = 0; i < locations.length; i++) {
    const rec = await prisma.securityLocation.upsert({
      where: { name: locations[i] },
      update: {},
      create: { name: locations[i], sortOrder: i, description: null }
    });
    locationRecords[locations[i]] = rec;
  }

  // ------------------------------------------------------------------
  // Sample reports (dev only)
  // ------------------------------------------------------------------
  const existing = await prisma.securityReport.count();
  if (existing === 0) {
    const baseDate = new Date();
    await prisma.securityReport.createMany({
      data: [
        {
          clientSubmissionId: "dev-sample-000001",
          serverReference: "WATCH-2026-000101",
          reporterType: ReporterType.STUDENT,
          isAnonymous: false,
          fullName: "Ada Obi",
          studentId: "BMU/2023/001",
          department: "Anatomy",
          faculty: "Basic Medical Sciences",
          email: "ada.obi@example.dev",
          phone: "08012345678",
          categoryId: categoryRecords["Theft / Missing Property"].id,
          locationId: locationRecords["Library"].id,
          urgency: Urgency.NORMAL,
          description: "A laptop was left at a study desk in the library and went missing while I stepped away for a few minutes.",
          status: "RESOLVED",
          createdAt: new Date(baseDate.getTime() - 3 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000)
        },
        {
          clientSubmissionId: "dev-sample-000002",
          serverReference: "WATCH-2026-000118",
          reporterType: ReporterType.STUDENT,
          isAnonymous: true,
          categoryId: categoryRecords["Hostel Security"].id,
          locationId: locationRecords["Hostel"].id,
          urgency: Urgency.URGENT,
          description: "An unknown person has been loitering around the female hostel entrance in the evenings for the past week.",
          status: "UNDER_INVESTIGATION",
          createdAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(baseDate.getTime() - 5 * 60 * 60 * 1000)
        },
        {
          clientSubmissionId: "dev-sample-000003",
          serverReference: "WATCH-2026-000124",
          reporterType: ReporterType.STAFF,
          isAnonymous: false,
          fullName: "Dr James Efe",
          staffId: "BMU/STAFF/014",
          department: "Cardiology",
          faculty: "Clinical Sciences",
          email: "james.efe@example.dev",
          phone: "08098765432",
          categoryId: categoryRecords["Suspicious Activity"].id,
          locationId: locationRecords["Main Campus"].id,
          urgency: Urgency.NORMAL,
          description: "Noticed unusually parked vehicles near the administrative block after hours just before the long weekend.",
          status: "RECEIVED",
          createdAt: new Date(baseDate.getTime() - 2 * 60 * 60 * 1000),
          updatedAt: new Date(baseDate.getTime() - 2 * 60 * 60 * 1000)
        }
      ]
    });

    // Sample responses on hidden (investigation) report
    const report2 = await prisma.securityReport.findFirst({
      where: { serverReference: "WATCH-2026-000118" }
    });
    if (report2) {
      await prisma.reportResponse.createMany({
        data: [
          {
            reportId: report2.id,
            authorRole: "USER",
            isFromAdmin: false,
            body: "There is suspicious activity around the hostel.",
            createdAt: new Date(baseDate.getTime() - 1 * 24 * 60 * 60 * 1000)
          },
          {
            reportId: report2.id,
            authorRole: "ADMIN",
            authorName: "Chief Security Officer",
            isFromAdmin: true,
            body: "Can you provide the exact location?",
            createdAt: new Date(baseDate.getTime() - 20 * 60 * 60 * 1000)
          },
          {
            reportId: report2.id,
            authorRole: "USER",
            isFromAdmin: false,
            body: "It is close to the rear entrance.",
            createdAt: new Date(baseDate.getTime() - 10 * 60 * 60 * 1000)
          },
          {
            reportId: report2.id,
            authorRole: "ADMIN",
            authorName: "Chief Security Officer",
            isFromAdmin: true,
            body: "Thank you. Security personnel have been notified.",
            createdAt: new Date(baseDate.getTime() - 5 * 60 * 60 * 1000)
          }
        ]
      });
    }
  } else {
    console.log("Sample reports already present; skipping.");
  }

  console.log("Seed complete.");
  console.log("--------------------------------------------------");
  console.log("DEV ADMIN CREDENTIALS (DO NOT USE IN PRODUCTION):");
  console.log(`  SUPER_ADMIN: ${superAdminEmail} / ${superAdminPassword}`);
  console.log(`  CSO:         ${csoEmail} / ${csoPassword}`);
  console.log(`  OFFICER:     ${officerEmail} / ${officerPassword}`);
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
