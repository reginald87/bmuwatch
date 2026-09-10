"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "../../AdminAuthProvider";
import { StatusBadge, UrgencyBadge, AnonymousBadge } from "@/components/Badges";
import { ADMIN_EDITABLE_STATUSES } from "@/lib/constants";
import { REPORT_STATUS_LABELS } from "@/lib/constants";

interface AdminUser {
  id: string;
  name: string;
  role: string;
}

interface ResponseItem {
  id: string;
  isFromAdmin: boolean;
  authorName: string | null;
  body: string;
  createdAt: string;
}

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface Assignment {
  id: string;
  assignee: string | null;
  assignedBy: string | null;
  note: string | null;
  assignedAt: string;
}

interface StatusHistoryItem {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  adminName: string | null;
  note: string | null;
  createdAt: string;
}

interface ReportDetail {
  id: string;
  serverReference: string;
  reporterType: string;
  isAnonymous: boolean;
  submittedBy: string;
  category: string;
  location: string;
  urgency: string;
  incidentDate: string | null;
  incidentTime: string | null;
  description: string;
  additionalInfo: string | null;
  status: string;
  createdAt: string;
  fullName: string | null;
  studentId: string | null;
  staffId: string | null;
  idNumber: string | null;
  department: string | null;
  faculty: string | null;
  email: string | null;
  phone: string | null;
  attachments: Attachment[];
  responses: ResponseItem[];
  assignments: Assignment[];
  statusHistory: StatusHistoryItem[];
}

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

export default function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { admin } = useAdmin();
  const router = useRouter();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Response
  const [reply, setReply] = useState("");
  // Status
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  // Assignment
  const [assigneeId, setAssigneeId] = useState("");
  const [assignNote, setAssignNote] = useState("");

  const canAssign = admin?.role === "SUPER_ADMIN" || admin?.role === "CSO";

  useEffect(() => {
    fetch(`/api/admin/reports/${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.report) setReport(d.report);
        else setError(d.error || "Report not found.");
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.users && setUsers(d.users))
      .catch(() => {});
  }, [id]);

  const doAction = async (url: string, body: any, onOk: () => void) => {
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Action failed.");
        return;
      }
      onOk();
      const fresh = await fetch(`/api/admin/reports/${id}`, { cache: "no-store" });
      const fd = await fresh.json();
      if (fd.report) setReport(fd.report);
    } catch {
      setError("Network error.");
    }
  };

  const sendResponse = (e: React.FormEvent) => {
    e.preventDefault();
    const text = reply.trim();
    if (!text) return;
    doAction(`/api/admin/reports/${id}/responses`, { body: text }, () => {
      setReply("");
      setMsg("Response sent.");
    });
  };

  const changeStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus) return;
    doAction(`/api/admin/reports/${id}/status`, { status: newStatus, note: statusNote }, () => {
      setNewStatus("");
      setStatusNote("");
      setMsg("Status updated.");
    });
  };

  const assign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId) return;
    doAction(`/api/admin/reports/${id}/assign`, { assigneeId, note: assignNote }, () => {
      setAssigneeId("");
      setAssignNote("");
      setMsg("Report assigned.");
    });
  };

  const downloadAttachment = (att: Attachment) => {
    window.open(`/api/admin/reports/${id}/attachments/${att.id}`, "_blank");
  };

  if (loading) return <div className="text-sm text-gray-400 dark:text-gray-500">Loading…</div>;

  if (!report) {
    return (
      <div className="space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
        <Link href="/admin/inbox" className="btn-secondary">Back to Inbox</Link>
        <button onClick={() => router.refresh()} className="btn-primary">Retry</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/inbox" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          ← Inbox
        </Link>
        <StatusBadge status={report.status} />
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-950/40 dark:text-green-300">{msg}</div>}

      <div className="flex items-center justify-between">
        <h1 className="font-mono text-xl font-bold text-brand-950 dark:text-brand-200">{report.serverReference}</h1>
        <AnonymousBadge isAnonymous={report.isAnonymous} />
      </div>

      {/* Key facts */}
      <section className="card grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
        <div>
          <div className="text-xs text-gray-400">Category</div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{report.category}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Urgency</div>
          <UrgencyBadge urgency={report.urgency} />
        </div>
        <div>
          <div className="text-xs text-gray-400">Location</div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{report.location}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Reporter type</div>
          <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {report.reporterType === "STUDENT" ? "Student" : "Staff"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Incident date</div>
          <div className="text-sm text-gray-800 dark:text-gray-200">{report.incidentDate ? fmt(report.incidentDate) : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-400">Reported</div>
          <div className="text-sm text-gray-800 dark:text-gray-200">{fmt(report.createdAt)}</div>
        </div>
      </section>

      {/* Reporter identity (privacy-aware) */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">Submitted by: {report.submittedBy}</h2>
        {report.isAnonymous ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This report was submitted anonymously. No identifying information is stored or shown.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Full name</span><div className="font-medium text-gray-800 dark:text-gray-200">{report.fullName ?? "—"}</div></div>
            <div><span className="text-gray-400">{report.reporterType === "STUDENT" ? "Student ID" : "Staff ID"}</span><div className="font-medium text-gray-800 dark:text-gray-200">{report.idNumber ?? "—"}</div></div>
            <div><span className="text-gray-400">Faculty</span><div className="text-gray-800 dark:text-gray-200">{report.faculty ?? "—"}</div></div>
            <div><span className="text-gray-400">Department</span><div className="text-gray-800 dark:text-gray-200">{report.department ?? "—"}</div></div>
            <div><span className="text-gray-400">Email</span><div className="text-gray-800 dark:text-gray-200">{report.email ?? "—"}</div></div>
            <div><span className="text-gray-400">Phone</span><div className="text-gray-800 dark:text-gray-200">{report.phone ?? "—"}</div></div>
          </div>
        )}
      </section>

      {/* Description */}
      <section className="card p-5">
        <h2 className="mb-2 text-sm font-bold text-gray-800 dark:text-gray-200">Description</h2>
        <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">{report.description}</p>
        {report.additionalInfo && (
          <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-400">{report.additionalInfo}</p>
        )}
      </section>

      {/* Attachments */}
      {report.attachments.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">Attachments</h2>
          <ul className="space-y-2">
            {report.attachments.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => downloadAttachment(a)}
                  className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-left text-sm text-brand-700 hover:bg-gray-50 dark:border-gray-700 dark:text-brand-400 dark:hover:bg-gray-800"
                >
                  <span>📎</span>
                  <span className="flex-1 truncate">{a.fileName}</span>
                  <span className="text-xs text-gray-400">{(a.sizeBytes / 1024).toFixed(0)} KB</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Conversation */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">Conversation</h2>
        {report.responses.length === 0 ? (
          <p className="text-sm text-gray-400">No messages yet.</p>
        ) : (
          <ul className="space-y-3">
            {report.responses.map((r) => (
              <li key={r.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                r.isFromAdmin ? "bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-200" : "ml-auto bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}>
                <div className={`text-[10px] font-semibold uppercase ${r.isFromAdmin ? "text-brand-600 dark:text-brand-400" : "text-gray-400"}`}>
                  {r.isFromAdmin ? (r.authorName || "Security") : "Reporter"}
                </div>
                <p className="whitespace-pre-wrap">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={sendResponse} className="mt-4 flex gap-2">
          <input
            className="input flex-1"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a response for the reporter…"
            maxLength={2000}
          />
          <button type="submit" className="btn-primary px-4" disabled={!reply.trim()}>Send</button>
        </form>
      </section>

      {/* Status management */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">Update Status</h2>
        <form onSubmit={changeStatus} className="flex flex-wrap gap-2">
          <select className="input max-w-xs flex-1" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <option value="">Select new status…</option>
            {ADMIN_EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>{REPORT_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <input
            className="input max-w-xs flex-1"
            value={statusNote}
            onChange={(e) => setStatusNote(e.target.value)}
            placeholder="Note (optional)"
            maxLength={300}
          />
          <button type="submit" className="btn-primary" disabled={!newStatus}>Update Status</button>
        </form>
      </section>

      {/* Assignment */}
      {canAssign && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">Assign to Officer</h2>
          <form onSubmit={assign} className="flex flex-wrap gap-2">
            <select className="input max-w-xs flex-1" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Select assignee…</option>
              {users
                .filter((u) => u.id !== admin?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role.replace(/_/g, " ")})</option>
                ))}
            </select>
            <input
              className="input max-w-xs flex-1"
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              placeholder="Assignment note (optional)"
              maxLength={300}
            />
            <button type="submit" className="btn-primary" disabled={!assigneeId}>Assign</button>
          </form>
          {report.assignments.length > 0 && (
            <div className="mt-3 space-y-1">
              {report.assignments.map((a) => (
                <div key={a.id} className="text-xs text-gray-500 dark:text-gray-400">
                  Assigned to {a.assignee} by {a.assignedBy} · {fmt(a.assignedAt)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Status history */}
      {report.statusHistory.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">Status History</h2>
          <ul className="space-y-2">
            {report.statusHistory.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                <span>
                  {h.fromStatus ? REPORT_STATUS_LABELS[h.fromStatus] ?? h.fromStatus : "Created"} →{" "}
                  {REPORT_STATUS_LABELS[h.toStatus] ?? h.toStatus}
                  {h.adminName ? ` by ${h.adminName}` : ""}
                </span>
                <span className="text-gray-400">{fmt(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
