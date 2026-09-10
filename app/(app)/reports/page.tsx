"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/client/db";
import { StatusBadge, UrgencyBadge } from "@/components/Badges";
import { useSync } from "@/components/providers/SyncProvider";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function MyReportsPage() {
  const reports = useLiveQuery(() => db.reports.orderBy("createdAt").reverse().toArray(), []);
  const { sync } = useSync();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">My Reports</h1>
      </div>

      {(!reports || reports.length === 0) && (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <span className="text-4xl" aria-hidden>📭</span>
          <p className="text-sm text-gray-600 dark:text-gray-400">You haven&apos;t submitted any reports yet.</p>
          <Link href="/report" className="btn-primary mt-1">
            Report a Security Concern
          </Link>
        </div>
      )}

      <ul className="space-y-3">
        {(reports ?? []).map((r) => (
          <li key={r.id}>
            <Link href={`/reports/${r.id}`} className="card block p-4 hover:border-brand-300 dark:hover:border-brand-600">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-semibold text-brand-800 dark:text-brand-300">
                  {r.serverReference ?? "Pending"}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-1.5 text-sm font-medium text-gray-800 dark:text-gray-100">{r.categoryName}</div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{r.locationName}</div>
              <div className="mt-2 flex items-center justify-between">
                <UrgencyBadge urgency={r.urgency} />
                <span className="text-xs text-gray-400 dark:text-gray-500">{timeAgo(r.createdAt)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {reports && reports.length > 0 && (
        <button onClick={() => sync({ manual: true })} className="btn-secondary w-full">
          Sync Now
        </button>
      )}
    </div>
  );
}
