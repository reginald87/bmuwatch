"use client";

import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  action: string;
  detail: string | null;
  adminName: string | null;
  reportReference: string | null;
  createdAt: string;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (pg: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/audit?page=${pg}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.logs) {
          setEntries(d.logs);
          setTotal(d.total);
          setTotalPages(d.totalPages);
        } else if (d.error) setError(d.error);
      })
      .catch(() => setError("Network error."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1);
  }, []);

  const fmt = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">Audit Log</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{total} recorded action{total === 1 ? "" : "s"}</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</div>}

      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No audit entries yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-400 dark:bg-gray-800/60 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2">Admin</th>
                  <th className="px-4 py-2">Action</th>
                  <th className="px-4 py-2">Detail</th>
                  <th className="px-4 py-2">Report</th>
                  <th className="px-4 py-2">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-200">{e.adminName ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {e.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{e.detail ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400">{e.reportReference ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{fmt(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => { setPage(page - 1); load(page - 1); }} className="btn-secondary py-2 text-sm">Prev</button>
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => { setPage(page + 1); load(page + 1); }} className="btn-secondary py-2 text-sm">Next</button>
        </div>
      )}
    </div>
  );
}
