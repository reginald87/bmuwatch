import { db } from "./db";
import {
  buildSyncPayload,
  getLocalReport,
  updateLocalReportStatus,
  setServerReference
} from "./reportRepo";
import { getInstallationId } from "./utils";
import type { LocalReport, ServerStatus } from "../types";

export type SyncStatus =
  | "ONLINE"
  | "OFFLINE"
  | "PENDING"
  | "SYNCING"
  | "FAILED"
  | "SUCCESS";

const API_BASE = "/api";

export interface SyncResult {
  status: SyncStatus;
  synced: number;
  failed: number;
  pending: number;
  error?: string;
  lastRun: number;
}

type Listener = (status: SyncStatus) => void;

class SyncManager {
  private listeners: Set<Listener> = new Set();
  private syncing = false;
  private lastStatus: SyncStatus = typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "ONLINE";
  private lastRun = Date.now();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.refreshStatus());
      window.addEventListener("offline", () => {
        this.lastStatus = "OFFLINE";
        this.emit();
      });
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.lastStatus);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l(this.lastStatus);
  }

  getStatus(): SyncStatus {
    return this.lastStatus;
  }

  getLastRun() {
    return this.lastRun;
  }

  isOnline(): boolean {
    return typeof navigator !== "undefined" && navigator.onLine;
  }

  private setStatus(s: SyncStatus) {
    this.lastStatus = s;
    this.emit();
  }

  private refreshStatus() {
    if (this.isOnline()) {
      this.lastStatus = "ONLINE";
      this.emit();
      // Auto sync when connectivity returns.
      this.sync().catch(() => {});
    } else {
      this.lastStatus = "OFFLINE";
      this.emit();
    }
  }

  async countPending(): Promise<number> {
    return db.syncQueue.count();
  }

  async runSync({ manual = false } = {}): Promise<SyncResult> {
    if (this.syncing) {
      return { status: this.getStatus(), synced: 0, failed: 0, pending: await this.countPending(), lastRun: this.lastRun };
    }
    this.syncing = true;
    this.setStatus("SYNCING");
    let synced = 0;
    let failed = 0;
    let offline = false;

    try {
      if (this.isOnline()) {
        const queue = await db.syncQueue.orderBy("createdAt").toArray();

        for (const entry of queue) {
          if (!this.isOnline()) break;
          const report = await getLocalReport(entry.localReportId);
          if (!report) {
            await db.syncQueue.delete(entry.id);
            continue;
          }

          try {
            // Upload the report + attachments.
            const serverReport = await this.uploadReport(report);

            // Persist the server reference and updated status locally.
            const serverStatus = serverReport.status as ServerStatus;
            await setServerReference(report.id, serverReport.serverReference, serverStatus);

            // Merge server responses into the local record.
            if (serverReport.responses && serverReport.responses.length > 0) {
              await this.mergeResponses(report.id, serverReport.responses);
            }

            await db.syncQueue.delete(entry.id);
            synced++;
          } catch (err) {
            failed++;
            await db.syncQueue.update(entry.id, {
              attempts: (entry.attempts || 0) + 1,
              lastError: err instanceof Error ? err.message : String(err)
            });
            await db.reports.update(report.id, { lastSyncError: err instanceof Error ? err.message : String(err) });
          }
        }

        // Download any new responses for already-synced local reports.
        if (manual || synced === 0) {
          await this.downloadResponses();
        }

        // Upload any pending user replies.
        await this.processResponseOutbox();
      } else {
        offline = true;
      }
    } finally {
      this.syncing = false;
      this.lastRun = Date.now();
      const pending = await this.countPending();
      if (offline) {
        this.setStatus("OFFLINE");
      } else if (failed > 0) {
        this.setStatus("FAILED");
      } else if (pending > 0) {
        this.setStatus("PENDING");
      } else {
        this.setStatus("SUCCESS");
      }
    }

    const pending = await this.countPending();
    return { status: this.getStatus(), synced, failed, pending, lastRun: this.lastRun };
  }

  async sync(options: { manual?: boolean } = {}) {
    return this.runSync(options);
  }

  private async uploadReport(report: LocalReport) {
    const payload = await buildSyncPayload(report);
    const res = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || `Server error (${res.status})`);
    }
    const data = await res.json();
    return data.report;
  }

  // Pull the latest responses from the server for already-synced local reports.
  private async downloadResponses(): Promise<void> {
    const installationId = await getInstallationId();
    const syncedReports = await db.reports
      .filter((r) =>
        !!r.clientSubmissionId &&
        !!r.serverReference &&
        ["SUBMITTED", "RECEIVED", "READ_BY_CSO", "UNDER_INVESTIGATION", "AWAITING_INFORMATION", "RESPONDED", "RESOLVED", "CLOSED"].includes(r.status)
      )
      .toArray();

    for (const r of syncedReports.slice(0, 20)) {
      if (!this.isOnline()) break;
      try {
        const res = await fetch(
          `${API_BASE}/reports/my?clientSubmissionId=${encodeURIComponent(r.clientSubmissionId)}&installationId=${encodeURIComponent(installationId)}`
        );
        if (res.ok) {
          const data = await res.json();
          const report = data.report;
          if (report) {
            await setServerReference(r.id, report.serverReference, report.status);
            if (report.responses?.length) {
              await this.mergeResponses(r.id, report.responses);
            }
          }
        }
      } catch {
        // ignore individual download failures; retry on next sync
      }
    }
  }

  private async processResponseOutbox(): Promise<void> {
    const installationId = await getInstallationId();
    const outbox = await db.responseOutbox.orderBy("createdAt").toArray();
    for (const entry of outbox) {
      if (!this.isOnline()) break;
      try {
        const res = await fetch(`${API_BASE}/reports/my/response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientSubmissionId: entry.clientSubmissionId,
            installationId,
            body: entry.body
          })
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || `Server error (${res.status})`);
        }
        // On success: clear the outbox entry and mark the local response reviewed.
        await db.responseOutbox.delete(entry.id);
        const report = await getLocalReport(entry.reportLocalId);
        if (report) {
          await db.reports.update(entry.reportLocalId, {
            responses: report.responses.map((r) =>
              r.id === entry.id ? { ...r, pending: false } : r
            )
          });
        }
      } catch (err) {
        await db.responseOutbox.update(entry.id, {
          attempts: entry.attempts + 1,
          lastError: err instanceof Error ? err.message : String(err)
        });
      }
    }
  }

  private async mergeResponses(localId: string, serverResponses: any[]) {
    const report = await getLocalReport(localId);
    if (!report) return;
    const existing = new Set(report.responses.map((r) => r.id));
    const newResponses = serverResponses.filter((r) => !existing.has(r.id));
    if (newResponses.length === 0) return;
    const merged = [
      ...report.responses,
      ...newResponses.map((r) => ({
        id: r.id,
        isFromAdmin: r.isFromAdmin,
        authorName: r.isFromAdmin ? r.authorName : null,
        body: r.body,
        createdAt: r.createdAt
      }))
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    await db.reports.update(localId, { responses: merged, updatedAt: new Date().toISOString() });
  }
}

// Singleton instance.
export const syncManager = new SyncManager();
