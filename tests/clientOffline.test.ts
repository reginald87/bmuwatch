import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createLocalReport,
  buildSyncPayload,
  getLocalReports,
  addLocalUserResponse
} from "../lib/client/reportRepo";
import { db } from "../lib/client/db";
import { syncManager } from "../lib/client/syncManager";

// Node 22 ships a real global `navigator` whose onLine is `false`, so the
// offline path is the natural default. Individual tests opt-in to "online" by
// stubbing navigator.onLine = true.
beforeEach(async () => {
  await db.transaction("rw", db.reports, db.syncQueue, db.responseOutbox, async () => {
    await db.reports.clear();
    await db.syncQueue.clear();
    await db.responseOutbox.clear();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const validInputLite = {
  reporterType: "STUDENT" as const,
  isAnonymous: true,
  categoryId: "cat-1",
  categoryName: "Suspicious Activity",
  locationId: "loc-1",
  locationName: "Main Campus",
  urgency: "NORMAL" as const,
  description: "Offline: a test report created without network.",
  attachments: []
};

describe("offline report creation", () => {
  it("persists a PENDING_SYNC report and queues it", async () => {
    const report = await createLocalReport(validInputLite);
    expect(report.status).toBe("PENDING_SYNC");
    expect(report.serverReference).toBeNull();

    const queued = await db.syncQueue.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].localReportId).toBe(report.id);
    expect(queued[0].clientSubmissionId).toBe(report.clientSubmissionId);

    const stored = await getLocalReports();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe(report.id);
  });

  it("does not store PII for anonymous reports", async () => {
    const report = await createLocalReport({
      ...validInputLite,
      isAnonymous: true,
      fullName: "Secret",
      studentId: "BMU/1",
      email: "secret@x.dev"
    });
    expect(report.fullName).toBeNull();
    expect(report.studentId).toBeNull();
    expect(report.email).toBeNull();
  });

  it("keeps PII for identified reports", async () => {
    const report = await createLocalReport({
      ...validInputLite,
      isAnonymous: false,
      fullName: "Ada Obi",
      studentId: "BMU/2023/001",
      email: "ada@x.dev"
    });
    expect(report.fullName).toBe("Ada Obi");
    expect(report.studentId).toBe("BMU/2023/001");
  });
});

describe("buildSyncPayload", () => {
  it("produces a server-compatible payload", async () => {
    const report = await createLocalReport({
      ...validInputLite,
      isAnonymous: false,
      fullName: "Ola",
      studentId: "BMU/2"
    });
    const payload = await buildSyncPayload(report);
    expect(payload.clientSubmissionId).toBe(report.clientSubmissionId);
    expect(payload.reporterType).toBe("STUDENT");
    expect(payload.categoryName).toBe("Suspicious Activity");
    expect(payload.locationName).toBe("Main Campus");
    expect(payload.urgency).toBe("NORMAL");
    expect(payload.description).toBe("Offline: a test report created without network.");
    expect(payload.attachments).toEqual([]);
    expect(payload.isAnonymous).toBe(false);
    expect(payload.fullName).toBe("Ola");
  });
});

describe("SyncManager end-to-end against mocked server", () => {
  it("uploads a queued report and removes it from the queue", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const report = await createLocalReport(validInputLite);

    let reportPosts = 0;
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      if (url === "/api/reports") {
        reportPosts++;
        const body = JSON.parse(init.body);
        expect(body.clientSubmissionId).toBe(report.clientSubmissionId);
        return {
          ok: true,
          json: async () => ({
            report: { serverReference: "WATCH-2026-000123", status: "RECEIVED", responses: [] }
          })
        };
      }
      // downloadResponses() -> /api/reports/my returns no new report here
      return { ok: true, json: async () => ({ report: null }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncManager.runSync({ manual: true });

    expect(reportPosts).toBe(1);
    expect(result.synced).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.status).toBe("SUCCESS");

    const remaining = await db.syncQueue.toArray();
    expect(remaining).toHaveLength(0);

    const updated = await getLocalReports();
    expect(updated[0].serverReference).toBe("WATCH-2026-000123");
    expect(updated[0].status).toBe("RECEIVED");
  });

  it("keeps the report and records an error when the server rejects", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const report = await createLocalReport(validInputLite);

    let posts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/reports") {
          posts++;
          return Promise.resolve({
            ok: false,
            status: 400,
            json: async () => ({ error: "Unknown report category" })
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ report: null }) });
      })
    );

    const result = await syncManager.runSync({ manual: true });

    expect(posts).toBe(1);
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.pending).toBe(1);
    expect(result.status).toBe("FAILED");

    const stillThere = await db.syncQueue.toArray();
    expect(stillThere).toHaveLength(1);
    expect(stillThere[0].attempts).toBe(1);
    expect(stillThere[0].lastError).toContain("Unknown report category");

    const stored = await getLocalReports();
    expect(stored[0].serverReference).toBeNull();
    expect(stored[0].lastSyncError).toContain("Unknown report category");
  });

  it("reports OFFLINE when not connected and does not call the server", async () => {
    // No navigator.onLine stub here -> Node's default (offline/false).
    await createLocalReport(validInputLite);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await syncManager.runSync({ manual: true });

    expect(result.status).toBe("OFFLINE");
    expect(fetchMock).not.toHaveBeenCalled();
    const stillThere = await db.syncQueue.toArray();
    expect(stillThere).toHaveLength(1);
  });
});

describe("response outbox", () => {
  it("enqueues an offline reply for delivery even before the report has synced", async () => {
    // Report created offline and NOT yet synced (no serverReference).
    const report = await createLocalReport(validInputLite);

    // User replies while still offline -> must be queued so it is not lost.
    await addLocalUserResponse(report.id, "Message sent offline");
    const outbox = await db.responseOutbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].body).toBe("Message sent offline");
    expect(outbox[0].clientSubmissionId).toBe(report.clientSubmissionId);

    const stored = await getLocalReports();
    expect(stored[0].responses).toHaveLength(1);
    expect(stored[0].responses[0].pending).toBe(true);
  });

  it("delivers an offline reply to the server once the parent report syncs", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    const report = await createLocalReport(validInputLite);
    await addLocalUserResponse(report.id, "Offline reply");

    // On reconnect, runSync uploads the report first, then delivers the outbox.
    const posted: { url: string; body: any }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, init?: any) => {
        posted.push({ url, body: init ? JSON.parse(init.body) : null });
        if (url === "/api/reports") {
          // Simulate the parent report being acknowledged by the server.
          return Promise.resolve({
            ok: true,
            json: async () => ({
              report: { serverReference: "WATCH-2026-000777", status: "RECEIVED", responses: [] }
            })
          });
        }
        if (url === "/api/reports/my") {
          return Promise.resolve({ ok: true, json: async () => ({ report: null }) });
        }
        // /api/reports/my/response -> successful delivery
        return Promise.resolve({
          ok: true,
          json: async () => ({ response: { id: "x", body: "Offline reply", createdAt: new Date().toISOString() } })
        });
      })
    );

    const result = await syncManager.runSync({ manual: true });

    expect(result.failed).toBe(0);
    const uploadCall = posted.find((p) => p.url === "/api/reports");
    const replyCall = posted.find((p) => p.url === "/api/reports/my/response");
    expect(uploadCall).toBeTruthy();
    expect(replyCall).toBeTruthy();
    expect(replyCall.body.clientSubmissionId).toBe(report.clientSubmissionId);
    expect(replyCall.body.body).toBe("Offline reply");

    // Outbox drained and the reply marked as no longer pending.
    const outbox = await db.responseOutbox.toArray();
    expect(outbox).toHaveLength(0);
    const stored = await getLocalReports();
    expect(stored[0].responses[0].pending).toBe(false);
  });
});
