import { URGENCY_LEVELS, REPORTER_TYPES, ReportCreatePayload, SERVER_STATUSES } from "./types";

export class ValidationError extends Error {
  status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+\-()\s]{7,20}$/;

// Considered safe upload types. Executables are rejected server-side too.
export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
]);

export const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB per file
export const MAX_ATTACHMENTS = 6;

// Forbids executable/wheel binary types regardless of extension.
const FORBIDDEN_EXTENSIONS = [
  "exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "sh", "apk", "dll", "so", "php", "jsp", "jar", "bin", "py", "rb"
];

export function validateStrings(value: unknown, field: string, opts: { required?: boolean; max?: number; allowEmpty?: boolean } = {}) {
  const { required = false, max, allowEmpty = false } = opts;
  if (value == null || value === "") {
    if (required) throw new ValidationError(`${field} is required.`);
    return "";
  }
  if (typeof value !== "string") throw new ValidationError(`${field} must be a string.`);
  const v = value.trim();
  if (!allowEmpty && v.length === 0 && required) throw new ValidationError(`${field} is required.`);
  if (max && v.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer.`);
  return v;
}

function requireOneOf(value: unknown, allowed: readonly string[], field: string): string {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new ValidationError(`${field} is invalid.`);
  }
  return value as string;
}

function optionalEmail(value: unknown, field: string): string | null {
  const v = validateStrings(value, field);
  if (v === "") return null;
  if (!EMAIL_RE.test(v)) throw new ValidationError(`${field} is not a valid email address.`);
  return v;
}

function optionalPhone(value: unknown, field: string): string | null {
  const v = validateStrings(value, field);
  if (v === "") return null;
  if (!PHONE_RE.test(v)) throw new ValidationError(`${field} is not a valid phone number.`);
  return v;
}

export function validateReportCreate(body: unknown): ReportCreatePayload {
  if (!body || typeof body !== "object") throw new ValidationError("Invalid request body.");
  const b = body as Record<string, unknown>;

  const clientSubmissionId = validateStrings(b.clientSubmissionId, "clientSubmissionId", {
    required: true,
    max: 64
  });
  if (!clientSubmissionId) throw new ValidationError("clientSubmissionId is required.");

  const installationId = validateStrings(b.installationId, "installationId", { required: true, max: 64 });

  const reporterType = requireOneOf(b.reporterType, REPORTER_TYPES, "reporterType");
  const isAnonymous = b.isAnonymous === true;

  // When anonymous, do not accept/retain identifying details.
  const fullName = isAnonymous ? null : validateStrings(b.fullName, "fullName", { max: 120 });
  const studentId = isAnonymous ? null : validateStrings(b.studentId, "studentId", { max: 40 });
  const staffId = isAnonymous ? null : validateStrings(b.staffId, "staffId", { max: 40 });
  const department = isAnonymous ? null : validateStrings(b.department, "department", { max: 120 });
  const faculty = isAnonymous ? null : validateStrings(b.faculty, "faculty", { max: 120 });
  const email = isAnonymous ? null : optionalEmail(b.email, "email");
  const phone = isAnonymous ? null : optionalPhone(b.phone, "phone");

  const categoryName = validateStrings(b.categoryName, "categoryName", { required: true, max: 120 });
  const locationName = validateStrings(b.locationName, "locationName", { required: true, max: 120 });

  const urgency = requireOneOf(b.urgency, URGENCY_LEVELS, "urgency");

  const incidentDate = b.incidentDate ? validateStrings(b.incidentDate, "incidentDate", { max: 30 }) : null;
  const incidentTime = b.incidentTime ? validateStrings(b.incidentTime, "incidentTime", { max: 20 }) : null;

  const description = validateStrings(b.description, "description", { required: true, max: 8000 });

  const additionalInfo = b.additionalInfo
    ? validateStrings(b.additionalInfo, "additionalInfo", { max: 4000 })
    : null;

  const attachmentsRaw = Array.isArray(b.attachments) ? b.attachments : [];
  if (attachmentsRaw.length > MAX_ATTACHMENTS) {
    throw new ValidationError(`You may attach at most ${MAX_ATTACHMENTS} files.`);
  }
  const attachments = attachmentsRaw.map((a) => {
    if (!a || typeof a !== "object") throw new ValidationError("Invalid attachment data.");
    const att = a as Record<string, unknown>;
    const fileName = validateStrings(att.fileName, "attachment.fileName", { required: true, max: 255 });
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (FORBIDDEN_EXTENSIONS.includes(ext)) {
      throw new ValidationError(`File type .${ext} is not allowed.`);
    }
    const mimeType = validateStrings(att.mimeType, "attachment.mimeType", { required: true, max: 100 });
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new ValidationError(`File type ${mimeType} is not allowed.`);
    }
    const sizeBytes = typeof att.sizeBytes === "number" ? att.sizeBytes : parseInt(String(att.sizeBytes), 10);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) throw new ValidationError("Invalid attachment size.");
    if (sizeBytes > MAX_ATTACHMENT_BYTES) {
      throw new ValidationError(`Attachment "${fileName}" exceeds the ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB limit.`);
    }
    const dataBase64 = typeof att.dataBase64 === "string" ? att.dataBase64 : null;
    return { fileName, mimeType, sizeBytes, dataBase64 };
  });

  return {
    clientSubmissionId,
    installationId,
    reporterType: reporterType as ReportCreatePayload["reporterType"],
    isAnonymous,
    fullName,
    studentId,
    staffId,
    department,
    faculty,
    email,
    phone,
    categoryName,
    locationName,
    urgency: urgency as ReportCreatePayload["urgency"],
    incidentDate,
    incidentTime,
    description,
    additionalInfo,
    attachments
  };
}

export function validateStatusTransition(toStatus: unknown): string {
  return requireOneOf(toStatus, SERVER_STATUSES, "status");
}
