"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAdmin } from "./AdminAuthProvider";

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

export default function AdminDashboardPage() {
  const { admin } = useAdmin();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.stats) setStats(d.stats);
        else if (d.error) setError(d.error);
      })
      .catch(() => setError("Could not load dashboard."));
  }, []);

  const primary = [
    { label: "Total Reports", value: stats?.total ?? 0, color: "text-brand-700", href: "/admin/inbox" },
    { label: "Unread", value: stats?.unread ?? 0, color: "text-sky-600", href: "/admin/inbox" },
    { label: "Urgent", value: stats?.urgent ?? 0, color: "text-amber-600", href: "/admin/inbox" },
    { label: "Critical", value: stats?.critical ?? 0, color: "text-red-600", href: "/admin/inbox" }
  ];

  const pipeline = [
    { label: "Open", value: stats?.open ?? 0 },
    { label: "Under Investigation", value: stats?.underInvestigation ?? 0 },
    { label: "Awaiting Information", value: stats?.awaitingInformation ?? 0 },
    { label: "Resolved", value: stats?.resolved ?? 0 },
    { label: "Closed", value: stats?.closed ?? 0 }
  ];

  const byReporter = [
    { label: "Student", value: stats?.student ?? 0 },
    { label: "Staff", value: stats?.staff ?? 0 },
    { label: "Anonymous", value: stats?.anonymous ?? 0 },
    { label: "Identified", value: stats?.identified ?? 0 }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">Security Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Welcome back, {admin?.name}. Here&apos;s the current status of campus reports.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</div>
      )}

      {/* Primary stats */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {primary.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 hover:border-brand-300">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{s.label}</div>
            <div className={`mt-1 text-3xl font-extrabold ${s.color} dark:brightness-125`}>{s.value}</div>
          </Link>
        ))}
      </section>

      {/* Pipeline */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">Report Pipeline</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {pipeline.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* By reporter */}
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-800 dark:text-gray-200">Reports by Source</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {byReporter.map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <Link href="/admin/inbox" className="btn-primary">Open Report Inbox</Link>
        <Link href="/admin/audit" className="btn-secondary">View Audit Log</Link>
      </div>
    </div>
  );
}
