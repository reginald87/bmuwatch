import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db";
import {
  receiveReport,
  addResponse,
  addUserResponseByClient,
  changeStatus,
  assignReport,
  getReportById
} from "../lib/reportService";
import { ApiError } from "../lib/validation";

let categoryId: string;
let locationId: string;
let adminId: string;
let assigneeId: string;

function payload(overrides: Record<string, unknown> = {}) {
  return {
    clientSubmissionId: `svc-${Math.random().toString(36).slice(2, 10)}`,
    installationId: "inst-service-test",
    reporterType: "STUDENT",
    isAnonymous: true,
    categoryName: "Suspicious Activity",
    locationName: "Main Campus",
    urgency: "NORMAL",
    description: "A service-layer test report describing a concern.",
    attachments: [],
    ...overrides
  } as any;
}

beforeAll(async () => {
  const category = await prisma.securityCategory.upsert({
    where: { name: "Suspicious Activity" },
    update: {},
    create: { name: "Suspicious Activity", sortOrder: 1 }
  });
  categoryId = category.id;

  const location = await prisma.securityLocation.upsert({
    where: { name: "Main Campus" },
    update: {},
    create: { name: "Main Campus", sortOrder: 1 }
  });
  locationId = location.id;

  const admin = await prisma.adminUser.create({
    data: { name: "Test CSO", email: `cso-${Date.now()}@test.dev`, passwordHash: "x", role: "CSO" }
  });
  adminId = admin.id;
  const assignee = await prisma.adminUser.create({
    data: { name: "Test Officer", email: `off-${Date.now()}@test.dev`, passwordHash: "x", role: "SECURITY_OFFICER" }
  });
  assigneeId = assignee.id;
});

afterAll(async () => {
  // Clean up only records created by this suite (by installation or test admin).
  await prisma.reportResponse.deleteMany({ where: { report: { installationId: "inst-service-test" } } });
  await prisma.reportAssignment.deleteMany({ where: { report: { installationId: "inst-service-test" } } });
  await prisma.reportStatusHistory.deleteMany({ where: { report: { installationId: "inst-service-test" } } });
  await prisma.reportAttachment.deleteMany({ where: { report: { installationId: "inst-service-test" } } });
  await prisma.securityReport.deleteMany({ where: { installationId: "inst-service-test" } });
  await prisma.auditLog.deleteMany({ where: { report: { installationId: "inst-service-test" } } });
  await prisma.adminUser.deleteMany({ where: { id: { in: [adminId, assigneeId] } } });
});

describe("receiveReport", () => {
  it("creates an anonymous student report without storing PII", async () => {
    const { report, created } = await receiveReport(
      payload({ isAnonymous: true, fullName: "Hidden", email: "hidden@x.dev", studentId: "BMU/1" })
    );
    expect(created).toBe(true);
    expect(report.isAnonymous).toBe(true);
    expect(report.serverReference).toMatch(/^WATCH-\d{4}-\d{6}$/);
    expect(report.status).toBe("RECEIVED");
    // Privacy: server must NOT persist identifying fields for anonymous reports.
    expect(report.fullName).toBeNull();
    expect(report.email).toBeNull();
    expect(report.studentId).toBeNull();
  });

  it("creates an identified staff report with details", async () => {
    const { report } = await receiveReport(
      payload({
        reporterType: "STAFF",
        isAnonymous: false,
        fullName: "Dr James",
        staffId: "BMU/STAFF/014",
        department: "Cardiology",
        faculty: "Clinical Sciences",
        email: "james@test.dev"
      })
    );
    expect(report.reporterType).toBe("STAFF");
    expect(report.fullName).toBe("Dr James");
    expect(report.staffId).toBe("BMU/STAFF/014");
  });

  it("is idempotent: duplicate clientSubmissionId returns same report, no duplicate", async () => {
    const id = `dup-${Date.now()}`;
    const p = payload({ clientSubmissionId: id });
    const first = await receiveReport(p);
    const second = await receiveReport(p);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.duplicated).toBe(true);
    expect(first.report.id).toBe(second.report.id);
    expect(first.report.serverReference).toBe(second.report.serverReference);
    const count = await prisma.securityReport.count({ where: { clientSubmissionId: id } });
    expect(count).toBe(1);
  });

  it("rejects unknown category and location", async () => {
    await expect(receiveReport(payload({ categoryName: "Does Not Exist" }))).rejects.toThrow(ApiError);
    await expect(receiveReport(payload({ locationName: "Nowhere" }))).rejects.toThrow(ApiError);
  });
});

describe("privacy on admin DTO", () => {
  it("anonymous report DTO exposes no identifying fields", async () => {
    const { report } = await receiveReport(payload({ isAnonymous: true }));
    const { adminReportDto } = await import("../lib/adminDto");
    const dto = adminReportDto(report);
    expect(dto.submittedBy).toBe("Anonymous");
    expect(dto.fullName).toBeNull();
    expect(dto.email).toBeNull();
    expect("idNumber" in dto ? (dto as any).idNumber : undefined).toBeUndefined();
  });

  it("identified report DTO exposes details", async () => {
    const { report } = await receiveReport(
      payload({ isAnonymous: false, fullName: "Ada Obi", studentId: "BMU/2023/001" })
    );
    const { adminReportDto } = await import("../lib/adminDto");
    const dto = adminReportDto(report);
    expect(dto.submittedBy).toBe("Ada Obi");
    expect(dto.studentId).toBe("BMU/2023/001");
  });
});

describe("two-way communication", () => {
  it("admin response + user response form a conversation and set RESPONDED", async () => {
    const { report } = await receiveReport(payload());
    await addResponse(report.id, { isFromAdmin: true, authorName: "CSO", body: "Where exactly?" }, adminId);
    const afterAdmin = await prisma.securityReport.findUnique({ where: { id: report.id } });
    expect(afterAdmin!.status).toBe("RESPONDED");

    await addUserResponseByClient(report.clientSubmissionId, "inst-service-test", "Rear entrance");
    const detail = await getReportById(report.id);
    const bodies = detail!.responses.map((r) => r.body);
    expect(bodies).toContain("Where exactly?");
    expect(bodies).toContain("Rear entrance");
    expect(detail!.responses.filter((r) => r.isFromAdmin).length).toBe(1);
  });

  it("user response is blocked if report does not belong to the installation", async () => {
    const { report } = await receiveReport(payload());
    await expect(
      addUserResponseByClient(report.clientSubmissionId, "some-other-installation", "hi")
    ).rejects.toThrow(ApiError);
  });
});

describe("status + assignment + audit", () => {
  it("changes status and records history", async () => {
    const { report } = await receiveReport(payload());
    await changeStatus(report.id, "UNDER_INVESTIGATION", adminId, "Starting review");
    const detail = await getReportById(report.id);
    expect(detail!.status).toBe("UNDER_INVESTIGATION");
    expect(detail!.statusHistory[0].admin?.name).toBe("Test CSO");
  });

  it("assigns a report to a security officer", async () => {
    const { report } = await receiveReport(payload());
    await assignReport(report.id, assigneeId, adminId, "Handle this case");
    const detail = await getReportById(report.id);
    expect(detail!.assignments[0].assignee.name).toBe("Test Officer");
  });

  it("writes audit log entries", async () => {
    const { report } = await receiveReport(payload());
    await changeStatus(report.id, "RESOLVED", adminId);
    const audit = await prisma.auditLog.count({ where: { reportId: report.id } });
    expect(audit).toBeGreaterThanOrEqual(1);
  });
});
