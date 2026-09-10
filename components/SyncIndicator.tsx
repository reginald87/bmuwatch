"use client";

import { useSync } from "./providers/SyncProvider";
import { getSyncStatusLabel } from "@/lib/client/syncUi";

// Floating sync button. Shows the current sync state via a colored dot and
// expands on tap to reveal details + a manual sync action.

export default function SyncIndicator() {
  const { status, pending, syncing, sync } = useSync();

  const dotColor =
    status === "PENDING"
      ? "bg-warn-400"
      : status === "FAILED"
      ? "bg-danger-500"
      : status === "OFFLINE"
      ? "bg-gray-400"
      : "bg-success-400";

  const label =
    status === "PENDING"
      ? `${pending} report${pending === 1 ? "" : "s"} pending`
      : status === "SYNCING"
      ? "Syncing…"
      : status === "FAILED"
      ? "Sync failed"
      : getSyncStatusLabel(status);

  return (
    <button
      onClick={() => !syncing && sync({ manual: true })}
      disabled={syncing}
      aria-label={syncing ? "Syncing…" : `Sync. Currently ${label}.`}
      className="group fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-800 shadow-lg shadow-brand-900/20 transition-all hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-70 dark:border-brand-700/60 dark:bg-brand-900 dark:text-brand-100 dark:hover:bg-brand-800"
    >
      <span className="relative flex h-3.5 w-3.5 items-center justify-center">
        <span className={`h-3 w-3 rounded-full ${dotColor} ${syncing || status === "SYNCING" ? "animate-pulse" : ""}`} />
      </span>
      {syncing ? "Syncing…" : "Sync"}
      <span className="sr-only">{label}</span>
    </button>
  );
}
