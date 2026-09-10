import Dexie, { type Table } from "dexie";
import type {
  LocalReport,
  LocalResponse,
  AttachmentDto,
  CategoryDto,
  LocationDto
} from "../types";

// Local client-side database. The app remains fully functional offline using
// only these stores; the server is only contacted by the sync manager.

export interface SyncQueueEntry {
  id: string;
  clientSubmissionId: string;
  localReportId: string; // references db.reports.id
  createdAt: string;
  attempts: number;
  lastError: string | null;
  lockedAt: string | null;
}

export interface AppMetadata {
  key: string;
  value: string;
}

export interface ResponseOutboxEntry {
  id: string;
  reportLocalId: string; // references db.reports.id
  clientSubmissionId: string; // of the parent report (for server idempotency)
  body: string;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  lockedAt: string | null;
}

class BMUWatchDB extends Dexie {
  reports!: Table<LocalReport, string>;
  syncQueue!: Table<SyncQueueEntry, string>;
  attachments!: Table<{ id: string; reportId: string; mimeType: string; fileName: string; sizeBytes: number; blob?: Blob }, string>;
  categories!: Table<CategoryDto, string>;
  locations!: Table<LocationDto, string>;
  meta!: Table<AppMetadata, string>;
  responseOutbox!: Table<ResponseOutboxEntry, string>;

  constructor() {
    super("bmu-watch-db");
    this.version(1).stores({
      reports: "id, clientSubmissionId, status, createdAt, updatedAt, serverReference, installationId",
      syncQueue: "id, clientSubmissionId, createdAt, lockedAt",
      attachments: "id, reportId",
      categories: "id, name",
      locations: "id, name",
      meta: "key",
      responseOutbox: "id, reportLocalId, clientSubmissionId, createdAt, lockedAt"
    });
  }
}

export const db = new BMUWatchDB();

export type { LocalReport, LocalResponse, AttachmentDto, CategoryDto, LocationDto };
