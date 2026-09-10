// Shared types and constants used across the client and server.

// Server-side statuses (stored in the database).
export const SERVER_STATUSES = [
  "SUBMITTED",
  "RECEIVED",
  "READ_BY_CSO",
  "UNDER_INVESTIGATION",
  "AWAITING_INFORMATION",
  "RESPONDED",
  "RESOLVED",
  "CLOSED"
] as const;

export type ServerStatus = (typeof SERVER_STATUSES)[number];

// Client-only status that also appears in the UI.
export type ReportStatus = "PENDING_SYNC" | ServerStatus;

// A report that has not yet been submitted to the server lives locally with
// PENDING_SYNC; once acknowledged by the server it uses a ServerStatus.
export const CLIENT_STATUSES: ReportStatus[] = ["PENDING_SYNC", ...SERVER_STATUSES];

export const URGENCY_LEVELS = ["NORMAL", "URGENT", "CRITICAL"] as const;
export type Urgency = (typeof URGENCY_LEVELS)[number];

export const REPORTER_TYPES = ["STUDENT", "STAFF"] as const;
export type ReporterType = (typeof REPORTER_TYPES)[number];

export const ADMIN_ROLES = ["SUPER_ADMIN", "CSO", "SECURITY_OFFICER"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface CategoryDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface LocationDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface AttachmentDto {
  localBlobId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

// Local report shape persisted to IndexedDB.
export interface LocalReport {
  id: string; // local record key
  clientSubmissionId: string; // UUID sent to server for idempotency
  serverReference: string | null;
  reporterType: ReporterType;
  isAnonymous: boolean;
  fullName?: string | null;
  studentId?: string | null;
  staffId?: string | null;
  department?: string | null;
  faculty?: string | null;
  email?: string | null;
  phone?: string | null;
  categoryId: string | null;
  categoryName: string | null;
  locationId: string | null;
  locationName: string | null;
  urgency: Urgency;
  incidentDate: string | null;
  incidentTime: string | null;
  description: string;
  additionalInfo: string | null;
  status: ReportStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  attachments: AttachmentDto[];
  responses: LocalResponse[];
  lastSyncError: string | null;
}

export interface LocalResponse {
  id: string;
  isFromAdmin: boolean;
  authorName: string | null;
  body: string;
  createdAt: string;
  pending?: boolean;
}

// Payload accepted by POST /api/reports for the public create endpoint.
export interface ReportCreatePayload {
  clientSubmissionId: string;
  installationId: string;
  reporterType: ReporterType;
  isAnonymous: boolean;
  fullName?: string | null;
  studentId?: string | null;
  staffId?: string | null;
  department?: string | null;
  faculty?: string | null;
  email?: string | null;
  phone?: string | null;
  categoryName: string;
  locationName: string;
  urgency: Urgency;
  incidentDate?: string | null;
  incidentTime?: string | null;
  description: string;
  additionalInfo?: string | null;
  attachments: ReportCreateAttachment[];
}

export interface ReportCreateAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataBase64?: string | null;
}
