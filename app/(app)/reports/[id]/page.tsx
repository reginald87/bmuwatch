"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/client/db";
import { StatusBadge, UrgencyBadge } from "@/components/Badges";
import { useSync } from "@/components/providers/SyncProvider";
import { addLocalUserResponse } from "@/lib/client/reportRepo";

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const report = useLiveQuery(() => db.reports.get(id), [id]);
  const { sync } = useSync();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  useEffect(() => {
    // Auto sync when the user opens a report so they get new responses.
    if (navigator.onLine) sync({ manual: true }).catch(() => {});
  }, [sync]);

  if (!report) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-gray-600">Report not found on this device.</p>
        <Link href="/reports" className="btn-secondary mt-4">Back to My Reports</Link>
      </div>
    );
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text || !report) return;
    setSending(true);
    setSentMsg(null);
    try {
      await addLocalUserResponse(report.id, text);
      setReply("");
      setSentMsg("Message saved and queued to send.");
      if (navigator.onLine) sync({ manual: true }).catch(() => {});
    } catch (err) {
      setSentMsg(err instanceof Error ? err.message : "Could not save message.");
    } finally {
      setSending(false);
    }
  };

  const fmtDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString() : "Not provided";

  return (
    <div className="space-y-4">
      <div>
        <Link href="/reports" className="text-sm font-medium text-brand-600 hover:underline">
          ← My Reports
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="font-mono text-lg font-bold text-brand-950 dark:text-brand-200">
          {report.serverReference ?? "Pending sync"}
        </h1>
        <StatusBadge status={report.status} />
      </div>

      <section className="card space-y-2.5 p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500 dark:text-gray-400">{report.categoryName}</span>
          <UrgencyBadge urgency={report.urgency} />
        </div>
        <div className="text-gray-500 dark:text-gray-400">{report.locationName}</div>
        <div className="flex flex-wrap gap-x-4 text-xs text-gray-400 dark:text-gray-500">
          <span>Reporter: {report.reporterType === "STUDENT" ? "Student" : "Staff"}</span>
          <span>{report.isAnonymous ? "Anonymous" : "Identified"}</span>
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          Incident: {fmtDate(report.incidentDate)}
          {report.incidentTime ? ` · ${report.incidentTime}` : ""}
        </div>
      </section>

      <section className="card p-4 text-sm">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Description
        </h2>
        <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{report.description}</p>
        {report.additionalInfo && (
          <p className="mt-3 whitespace-pre-wrap text-gray-600 dark:text-gray-400">{report.additionalInfo}</p>
        )}
      </section>

      {report.attachments.length > 0 && (
        <section className="card p-4 text-sm">
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Attachments
          </h2>
          <ul className="space-y-1.5">
            {report.attachments.map((a: { fileName: string; sizeBytes: number }, i: number) => (
              <li key={i} className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <span aria-hidden>📎</span>
                {a.fileName}
                <span className="text-xs text-gray-400 dark:text-gray-500">({(a.sizeBytes / 1024).toFixed(0)} KB)</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Conversation */}
      <section className="card p-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Conversation
        </h2>
        {report.responses.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No messages yet. The CSO response will appear here.</p>
        ) : (
          <ul className="space-y-3">
            {report.responses.map((r: { id: string; isFromAdmin: boolean; authorName: string | null; body: string; pending?: boolean }) => (
              <li
                key={r.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  r.isFromAdmin
                    ? "bg-brand-50 text-brand-900 dark:bg-brand-900/50 dark:text-brand-100"
                    : "ml-auto bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100"
                }`}
              >
                <div className={`text-[10px] font-semibold uppercase ${r.isFromAdmin ? "text-brand-600 dark:text-brand-300" : "text-gray-400 dark:text-gray-500"}`}>
                  {r.isFromAdmin ? (r.authorName || "Security") : "You"}
                  {r.pending ? " · sending…" : ""}
                </div>
                <p className="whitespace-pre-wrap">{r.body}</p>
              </li>
            ))}
          </ul>
        )}

        {report.status !== "CLOSED" && report.status !== "RESOLVED" && (
          <form onSubmit={handleReply} className="mt-4 flex gap-2">
            <input
              className="input flex-1"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type a reply…"
              maxLength={2000}
            />
            <button type="submit" className="btn-primary px-4" disabled={sending || !reply.trim()}>
              Send
            </button>
          </form>
        )}
        {sentMsg && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{sentMsg}</p>}
      </section>

      {report.lastSyncError && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          Sync failed. Your report is still saved on this device.
        </p>
      )}
    </div>
  );
}
