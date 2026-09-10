import { prisma } from "./db";
import { ReportCreatePayload, ServerStatus } from "./types";
import { ApiError } from "./validation";
import { ALLOWED_MIME, MAX_ATTACHMENT_BYTES } from "./validation";
import { writeAudit } from "./audit";
import fs from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const UPLOAD_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt"
};

// Generates the next server reference: WATCH-YYYY-######
async function nextServerReference(year: number): Promise<string> {
  const prefix = `WATCH-${year}-`;
  const last = await prisma.securityReport.findMany({
    where: { serverReference: { startsWith: prefix } },
    orderBy: { serverReference: "desc" },
    take: 1,
    select: { serverReference: true }
  });
  let next = 1;
  if (last.length > 0) {
    const num = parseInt(last[0].serverReference.slice(prefix.length), 10);
    if (Number.isFinite(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(6, "0")}`;
}

export interface AttachmentStorage {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Buffer;
}

// Finds (or creates) a category/location by name. Active-only when receiving reports.
async function resolveCategory(name: string) {
  return prisma.securityCategory.findFirst({ where: { name, isActive: true } });
}
async function resolveLocation(name: string) {
  return prisma.securityLocation.findFirst({ where: { name, isActive: true } });
}

// Returns the report DTO (omitting identifying data when anonymous) for a server record.
export function toPublicReport(report: any) {
  const base = {
    id: report.id,
    serverReference: report.serverReference,
    reporterType: report.reporterType,
    isAnonymous: report.isAnonymous,
    category: report.category?.name ?? report.categoryName,
    location: report.location?.name ?? report.locationName,
    urgency: report.urgency,
    incidentDate: report.incidentDate,
    incidentTime: report.incidentTime,
    description: report.description,
    additionalInfo: report.additionalInfo,
    status: report.status,
    createdAt: report.createdAt,
    attachments: (report.attachments ?? []).map((a: any) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes
    })),
    responses: (report.responses ?? []).map((r: any) => ({
      id: r.id,
      isFromAdmin: r.isFromAdmin,
      authorName: r.isFromAdmin ? r.authorName : null,
      body: r.body,
      createdAt: r.createdAt
    }))
  };
  // Anonymous: do NOT expose any identifying fields to admin/CSO interfaces.
  if (report.isAnonymous) {
    return {
      ...base,
      fullName: null,
      studentId: null,
      staffId: null,
      department: null,
      faculty: null,
      email: null,
      phone: null
    };
  }
  return {
    ...base,
    fullName: report.fullName,
    studentId: report.studentId,
    staffId: report.staffId,
    department: report.department,
    faculty: report.faculty,
    email: report.email,
    phone: report.phone
  };
}

let attachmentDirReady: Promise<void> | null = null;
async function ensureUploadDir() {
  if (!attachmentDirReady) {
    attachmentDirReady = fs.mkdir(uploadRoot(), { recursive: true }).then(() => undefined);
  }
  return attachmentDirReady;
}

// server-only helper resolved lazily so we don't compute at import time
function uploadRoot() {
  return process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : UPLOAD_ROOT;
}

async function storeAttachmentFile(att: { fileName: string; mimeType: string; sizeBytes: number; dataBase64?: string | null }): Promise<{ storageKey: string; data: Buffer }> {
  if (!ALLOWED_MIME.has(att.mimeType)) {
    throw new ApiError(400, `File type ${att.mimeType} is not allowed.`);
  }
  if (att.sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(400, `Attachment "${att.fileName}" exceeds size limit.`);
  }
  if (!att.dataBase64) {
    throw new ApiError(400, "Attachment has no file data.");
  }
  const data = Buffer.from(att.dataBase64, "base64");
  const ext = UPLOAD_EXT[att.mimeType] ?? "";
  const storageKey = `att-${crypto.randomUUID()}${ext}`;
  await ensureUploadDir();
  await fs.writeFile(path.join(uploadRoot(), storageKey), data);
  return { storageKey, data };
}

/**
 * Receives (creates) a report. Idempotent on clientSubmissionId:
 * if the same client submission id is seen again, the existing report is
 * returned rather than creating a duplicate.
 */
export async function receiveReport(payload: ReportCreatePayload) {
  // Idempotency: reuse existing report if this client already submitted.
  const existing = await prisma.securityReport.findUnique({
    where: { clientSubmissionId: payload.clientSubmissionId },
    include: { category: true, location: true, attachments: true, responses: true }
  });
  if (existing) {
    return { report: existing, duplicated: true, created: false };
  }

  const category = await resolveCategory(payload.categoryName);
  if (!category) throw new ApiError(400, `Unknown report category: "${payload.categoryName}".`);
  const location = await resolveLocation(payload.locationName);
  if (!location) throw new ApiError(400, `Unknown report location: "${payload.locationName}".`);

  const serverReference = await nextServerReference(new Date().getFullYear());

  // Incident date: keep as a date if provided.
  let incidentDate: Date | null = null;
  if (payload.incidentDate) {
    const d = new Date(payload.incidentDate);
    if (!Number.isNaN(d.getTime())) incidentDate = d;
  }

  const report = await prisma.securityReport.create({
    data: {
      clientSubmissionId: payload.clientSubmissionId,
      serverReference,
      reporterType: payload.reporterType,
      isAnonymous: payload.isAnonymous,
      // Privacy: never persist identifying details for anonymous reports.
      fullName: payload.isAnonymous ? null : payload.fullName ?? null,
      studentId: payload.isAnonymous ? null : payload.studentId ?? null,
      staffId: payload.isAnonymous ? null : payload.staffId ?? null,
      department: payload.isAnonymous ? null : payload.department ?? null,
      faculty: payload.isAnonymous ? null : payload.faculty ?? null,
      email: payload.isAnonymous ? null : payload.email ?? null,
      phone: payload.isAnonymous ? null : payload.phone ?? null,
      categoryId: category.id,
      locationId: location.id,
      urgency: payload.urgency,
      incidentDate,
      incidentTime: payload.incidentTime ?? null,
      description: payload.description,
      additionalInfo: payload.additionalInfo ?? null,
      status: "RECEIVED",
      installationId: payload.installationId ?? null
    },
    include: { category: true, location: true, attachments: true, responses: true }
  });

  // Store + record attachments.
  for (const att of payload.attachments) {
    const { storageKey } = await storeAttachmentFile(att);
    await prisma.reportAttachment.create({
      data: {
        reportId: report.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        sizeBytes: att.sizeBytes,
        storageKey
      }
    });
  }

  const full = await prisma.securityReport.findUnique({
    where: { id: report.id },
    include: { category: true, location: true, attachments: true, responses: true }
  });
  return { report: full, duplicated: false, created: true };
}

// Fetch reports associated with a given installation (for local report history sync).
export async function getReportsForInstallation(installationId: string) {
  return prisma.securityReport.findMany({
    where: { installationId },
    orderBy: { createdAt: "desc" },
    include: { category: true, location: true, attachments: true, responses: true }
  });
}

// Fetch a single report for a given installation (authorization by installation).
export async function getReportForInstallation(id: string, installationId: string) {
  return prisma.securityReport.findFirst({
    where: { id, installationId },
    include: { category: true, location: true, attachments: true, responses: true }
  });
}

export async function getReportById(id: string) {
  return prisma.securityReport.findUnique({
    where: { id },
    include: { category: true, location: true, attachments: true, responses: true, assignments: { include: { assignee: true, assignedBy: true } }, statusHistory: { include: { admin: true }, orderBy: { createdAt: "desc" } } }
  });
}

// Fetch a single report by serverReference (public-safe, only used with verification)
export async function getReportByReference(reference: string) {
  return prisma.securityReport.findUnique({
    where: { serverReference: reference },
    include: { category: true, location: true, attachments: true, responses: true }
  });
}

export async function addResponse(
  reportId: string,
  input: { isFromAdmin: boolean; authorName?: string | null; body: string },
  adminId?: string
) {
  const report = await prisma.securityReport.findUnique({ where: { id: reportId } });
  if (!report) throw new ApiError(404, "Report not found.");

  const response = await prisma.reportResponse.create({
    data: {
      reportId,
      isFromAdmin: input.isFromAdmin,
      authorName: input.isFromAdmin ? input.authorName ?? null : null,
      body: input.body
    }
  });

  // If an admin responded, set status to RESPONDED (unless already resolved/closed).
  if (input.isFromAdmin) {
    if (report.status !== "RESOLVED" && report.status !== "CLOSED") {
      await prisma.securityReport.update({ where: { id: reportId }, data: { status: "RESPONDED" } });
      await prisma.reportStatusHistory.create({
        data: {
          reportId,
          fromStatus: report.status,
          toStatus: "RESPONDED",
          adminId: adminId ?? null,
          note: "Admin responded"
        }
      });
    }
    if (adminId) {
      await writeAudit({ adminId, action: "RESPONDED", reportId, detail: "Sent response" });
    }
  }

  return response;
}

// Adds a user (reporter) response, verified via clientSubmissionId + installationId.
export async function addUserResponseByClient(clientSubmissionId: string, installationId: string, body: string) {
  const report = await prisma.securityReport.findFirst({
    where: { clientSubmissionId, installationId }
  });
  if (!report) throw new ApiError(404, "Report not found for this device.");
  return addResponse(report.id, { isFromAdmin: false, body });
}

export async function changeStatus(
  reportId: string,
  toStatus: ServerStatus,
  adminId: string,
  note?: string | null
) {
  const report = await prisma.securityReport.findUnique({ where: { id: reportId } });
  if (!report) throw new ApiError(404, "Report not found.");

  const updated = await prisma.securityReport.update({
    where: { id: reportId },
    data: { status: toStatus }
  });
  await prisma.reportStatusHistory.create({
    data: {
      reportId,
      fromStatus: report.status,
      toStatus,
      adminId,
      note: note ?? null
    }
  });
  await writeAudit({ adminId, action: "STATUS_CHANGED", reportId, detail: `${report.status} -> ${toStatus}` });
  return updated;
}

export async function assignReport(
  reportId: string,
  assigneeId: string,
  assignedById: string,
  note?: string | null
) {
  const report = await prisma.securityReport.findUnique({ where: { id: reportId } });
  if (!report) throw new ApiError(404, "Report not found.");
  const assignee = await prisma.adminUser.findUnique({ where: { id: assigneeId, isActive: true } });
  if (!assignee) throw new ApiError(404, "Assignee not found.");

  const assignment = await prisma.reportAssignment.create({
    data: {
      reportId,
      assigneeId,
      assignedById,
      note: note ?? null
    }
  });
  const assignor = await prisma.adminUser.findUnique({ where: { id: assignedById } });
  await writeAudit({
    adminId: assignedById,
    action: "ASSIGNED",
    reportId,
    detail: `Assigned to ${assignee.name}${assignor ? ` by ${assignor.name}` : ""}`
  });
  return assignment;
}

export async function markViewed(reportId: string, adminId: string) {
  const report = await prisma.securityReport.findUnique({ where: { id: reportId } });
  if (!report) return;
  if (report.status === "RECEIVED") {
    await prisma.securityReport.update({ where: { id: reportId }, data: { status: "READ_BY_CSO" } });
    await prisma.reportStatusHistory.create({
      data: { reportId, fromStatus: "RECEIVED", toStatus: "READ_BY_CSO", adminId, note: "Viewed by CSO" }
    });
  }
  await writeAudit({ adminId, action: "VIEWED", reportId });
}

// Resolves and returns the file path for an attachment's storage key.
export function attachmentPath(storageKey: string): string {
  return path.join(uploadRoot(), path.basename(storageKey));
}
