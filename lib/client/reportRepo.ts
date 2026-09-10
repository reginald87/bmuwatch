import { db } from "./db";
import { cryptoRandomUuid, getInstallationId } from "./utils";
import type { LocalReport, ReportStatus, ReportCreatePayload, Urgency, ReporterType } from "../types";

export interface CreateLocalReportInput {
  reporterType: ReporterType;
  isAnonymous: boolean;
  fullName?: string | null;
  studentId?: string | null;
  staffId?: string | null;
  department?: string | null;
  faculty?: string | null;
  email?: string | null;
  phone?: string | null;
  categoryId: string;
  categoryName: string;
  locationId: string;
  locationName: string;
  urgency: Urgency;
  incidentDate?: string | null;
  incidentTime?: string | null;
  description: string;
  additionalInfo?: string | null;
  attachments: { clientFileId: string; fileName: string; mimeType: string; sizeBytes: number }[];
}

// Creates a report locally in IndexedDB and queues it for synchronization.
// Never fails because the network is unavailable — the report is persisted
// locally and synced later.
export async function createLocalReport(input: CreateLocalReportInput): Promise<LocalReport> {
  const now = new Date().toISOString();
  const clientSubmissionId = cryptoRandomUuid();
  const localId = cryptoRandomUuid();
  const installationId = await getInstallationId();

  const report: LocalReport = {
    id: localId,
    clientSubmissionId,
    serverReference: null,
    reporterType: input.reporterType,
    isAnonymous: input.isAnonymous,
    fullName: input.isAnonymous ? null : input.fullName ?? null,
    studentId: input.isAnonymous ? null : input.studentId ?? null,
    staffId: input.isAnonymous ? null : input.staffId ?? null,
    department: input.isAnonymous ? null : input.department ?? null,
    faculty: input.isAnonymous ? null : input.faculty ?? null,
    email: input.isAnonymous ? null : input.email ?? null,
    phone: input.isAnonymous ? null : input.phone ?? null,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    locationId: input.locationId,
    locationName: input.locationName,
    urgency: input.urgency,
    incidentDate: input.incidentDate ?? null,
    incidentTime: input.incidentTime ?? null,
    description: input.description,
    additionalInfo: input.additionalInfo ?? null,
    status: "PENDING_SYNC",
    createdAt: now,
    updatedAt: now,
    attachments: input.attachments.map((a) => ({
      localBlobId: a.clientFileId,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes
    })),
    responses: [],
    lastSyncError: null,
    // installationId is stored in the report itself for reference
  } as LocalReport & { installationId?: string };

  await db.transaction("rw", db.reports, db.syncQueue, async () => {
    await db.reports.add(report);
    await db.syncQueue.add({
      id: cryptoRandomUuid(),
      clientSubmissionId,
      localReportId: localId,
      createdAt: now,
      attempts: 0,
      lastError: null,
      lockedAt: null
    });
  });

  return report;
}

export async function updateLocalReportStatus(id: string, status: ReportStatus): Promise<void> {
  await db.reports.update(id, { status, updatedAt: new Date().toISOString() });
}

export async function setServerReference(id: string, serverReference: string, status: ReportStatus): Promise<void> {
  await db.reports.update(id, { serverReference, status, updatedAt: new Date().toISOString() });
}

export async function getLocalReports(): Promise<LocalReport[]> {
  return db.reports.orderBy("createdAt").reverse().toArray();
}

export async function getLocalReport(id: string): Promise<LocalReport | undefined> {
  return db.reports.get(id);
}

export async function deleteLocalReport(id: string): Promise<void> {
  await db.transaction("rw", db.reports, db.syncQueue, db.attachments, async () => {
    await db.reports.delete(id);
    await db.syncQueue.where("localReportId").equals(id).delete();
    const atts = await db.attachments.where("reportId").equals(id).toArray();
    for (const a of atts) await db.attachments.delete(a.id);
  });
}

// Clears all local report data (and associated attachments). The user should
// be warned that synced reports remain on the server and that this clears
// the local view only.
export async function clearAllLocalReports(): Promise<void> {
  await db.transaction("rw", db.reports, db.syncQueue, db.attachments, async () => {
    await db.reports.clear();
    await db.syncQueue.clear();
    await db.attachments.clear();
  });
}

/** Persist an attachment blob associated with a local report. */
export async function saveLocalAttachment(reportId: string, clientFileId: string, file: { name: string; type: string; size: number }, blob: Blob): Promise<void> {
  await db.attachments.add({
    id: clientFileId,
    reportId,
    mimeType: file.type,
    fileName: file.name,
    sizeBytes: file.size,
    blob
  });
}

/** Retrieve a stored attachment blob for a local report. */
export async function getLocalAttachmentBlob(clientFileId: string): Promise<Blob | undefined> {
  const att = await db.attachments.get(clientFileId);
  return att?.blob;
}

// Build a server-bound payload from a local report, including attachment data.
export async function buildSyncPayload(report: LocalReport): Promise<ReportCreatePayload> {
  const installationId = await getInstallationId();
  const attachments: ReportCreatePayload["attachments"] = [];
  for (const a of report.attachments ?? []) {
    const blob = a.localBlobId ? await getLocalAttachmentBlob(a.localBlobId) : undefined;
    let dataBase64: string | null = null;
    if (blob) {
      dataBase64 = await blobToBase64(blob);
    }
    attachments.push({
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      dataBase64
    });
  }
  return {
    clientSubmissionId: report.clientSubmissionId,
    installationId,
    reporterType: report.reporterType,
    isAnonymous: report.isAnonymous,
    fullName: report.fullName,
    studentId: report.studentId,
    staffId: report.staffId,
    department: report.department,
    faculty: report.faculty,
    email: report.email,
    phone: report.phone,
    categoryName: report.categoryName!,
    locationName: report.locationName!,
    urgency: report.urgency,
    incidentDate: report.incidentDate,
    incidentTime: report.incidentTime,
    description: report.description,
    additionalInfo: report.additionalInfo,
    attachments
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Adds a user (reporter) reply to a locally stored report and queues it for
 * synchronization to the server. Works fully offline — the reply is stored
 * locally first and synced later.
 */
export async function addLocalUserResponse(reportLocalId: string, body: string): Promise<void> {
  const report = await getLocalReport(reportLocalId);
  if (!report) throw new Error("Report not found on this device.");

  const now = new Date().toISOString();
  const response = {
    id: cryptoRandomUuid(),
    isFromAdmin: false,
    authorName: null, // anonymous identity is never used
    body,
    createdAt: now,
    pending: true
  };

  await db.transaction("rw", db.reports, db.responseOutbox, async () => {
    const updated = [...report.responses, response];
    await db.reports.update(reportLocalId, { responses: updated, updatedAt: now });
    // Always enqueue the reply for delivery. The server associates a reply with
    // the parent report via clientSubmissionId + installationId, so delivery is
    // safe even for a report that hasn't synced yet. SyncManager.processResponseOutbox
    // runs after the upload queue in the same cycle and retries on failure, so an
    // offline reply to a still-unsynced report is still sent once it reaches the server.
    await db.responseOutbox.add({
      id: response.id,
      reportLocalId,
      clientSubmissionId: report.clientSubmissionId,
      body,
      createdAt: now,
      attempts: 0,
      lastError: null,
      lockedAt: null
    });
  });
}
