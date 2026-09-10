"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge, UrgencyBadge, AnonymousBadge } from "@/components/Badges";
import { ADMIN_EDITABLE_STATUSES } from "@/lib/constants";

interface Filters {
  category: string;
  status: string;
  urgency: string;
  reporterType: string;
  anonymity: string;
  location: string;
  from: string;
  to: string;
  q: string;
  sort: string;
}

const DEFAULT_FILTERS: Filters = {
  category: "",
  status: "",
  urgency: "",
  reporterType: "",
  anonymity: "",
  location: "",
  from: "",
  to: "",
  q: "",
  sort: "newest"
};

interface Report {
  id: string;
  serverReference: string;
  reporterType: string;
  isAnonymous: boolean;
  category: string;
  location: string;
  urgency: string;
  status: string;
  createdAt: string;
}

interface Stats {
  total: number;
  unread: number;
  urgent: number;
  critical: number;
  open: number;
  underInvestigation: number;
  awaitingInformation: number;
  resolved: number;
  closed: number;
  student: number;
  staff: number;
  anonymous: number;
  identified: number;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function AdminInboxPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/categories", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/locations", { cache: "no-store" }).then((r) => r.json())
    ])
      .then(([c, l]) => {
        if (Array.isArray(c.categories)) setCategories(c.categories);
        if (Array.isArray(l.locations)) setLocations(l.locations);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async (f: Filters, pg: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (f.category) params.set("category", f.category);
    if (f.status) params.set("status", f.status);
    if (f.urgency) params.set("urgency", f.urgency);
    if (f.reporterType) params.set("reporterType", f.reporterType);
    if (f.anonymity) params.set("anonymity", f.anonymity);
    if (f.location) params.set("location", f.location);
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
    if (f.q) params.set("q", f.q);
    params.set("sort", f.sort);
    params.set("page", String(pg));
    try {
      const res = await fetch(`/api/admin/reports?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load reports.");
      } else {
        setReports(data.reports ?? []);
        setTotal(data.total ?? 0);
        setTotalPages(data.totalPages ?? 1);
        setStats(data.stats);
      }
    } catch {
      setError("Network error loading reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(DEFAULT_FILTERS, 1);
  }, [load]);

  const setFilter = (key: keyof Filters, value: string) => {
    const f = { ...filters, [key]: value };
    setFilters(f);
    setPage(1);
    load(f, 1);
  };

  const reset = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    load(DEFAULT_FILTERS, 1);
  };

  const displayStatus = (s: string) => (ADMIN_EDITABLE_STATUSES.includes(s) ? s : s);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">Report Inbox</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {total} report{total === 1 ? "" : "s"} found
        </p>
      </div>

      {/* Filters */}
      <section className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <select className="input" value={filters.category} onChange={(e) => setFilter("category", e.target.value)}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select className="input" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">All statuses</option>
            {ADMIN_EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>{displayStatus(s).replace(/_/g, " ")}</option>
            ))}
          </select>
          <select className="input" value={filters.urgency} onChange={(e) => setFilter("urgency", e.target.value)}>
            <option value="">All urgencies</option>
            <option value="NORMAL">Normal</option>
            <option value="URGENT">Urgent</option>
            <option value="CRITICAL">Critical</option>
          </select>
          <select className="input" value={filters.reporterType} onChange={(e) => setFilter("reporterType", e.target.value)}>
            <option value="">Student or Staff</option>
            <option value="STUDENT">Student</option>
            <option value="STAFF">Staff</option>
          </select>
          <select className="input" value={filters.anonymity} onChange={(e) => setFilter("anonymity", e.target.value)}>
            <option value="">Anonymous or Identified</option>
            <option value="ANONYMOUS">Anonymous</option>
            <option value="IDENTIFIED">Identified</option>
          </select>
          <select className="input" value={filters.location} onChange={(e) => setFilter("location", e.target.value)}>
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <input
            type="date"
            className="input"
            value={filters.from}
            onChange={(e) => setFilter("from", e.target.value)}
            placeholder="From"
          />
          <input
            type="date"
            className="input"
            value={filters.to}
            onChange={(e) => setFilter("to", e.target.value)}
            placeholder="To"
          />
          <input
            className="input col-span-2 sm:col-span-1"
            placeholder="Search reference or description…"
            value={filters.q}
            onChange={(e) => setFilter("q", e.target.value)}
          />
          <select className="input" value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="urgency">By urgency</option>
          </select>
          <button onClick={reset} className="btn-secondary py-2 text-sm">Reset</button>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      )}

      {/* List */}
      <section className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : reports.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No reports match your filters.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {reports.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/inbox/${r.id}`} className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <UrgencyBadge urgency={r.urgency} />
                      <span className="font-medium text-gray-800 dark:text-gray-200">{r.category}</span>
                      <AnonymousBadge isAnonymous={r.isAnonymous} />
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {r.location} · {r.reporterType === "STUDENT" ? "Student" : "Staff"}
                    </span>
                    <span>{timeAgo(r.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-gray-400">{r.serverReference}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            disabled={page <= 1 || loading}
            onClick={() => {
              const p = page - 1;
              setPage(p);
              load(filters, p);
            }}
            className="btn-secondary py-2 text-sm"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => {
              const p = page + 1;
              setPage(p);
              load(filters, p);
            }}
            className="btn-secondary py-2 text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
