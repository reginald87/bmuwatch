import { REPORT_STATUS_LABELS, URGENCY_LABELS } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const style: Record<string, string> = {
    PENDING_SYNC: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    RECEIVED: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    READ_BY_CSO: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    UNDER_INVESTIGATION: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    AWAITING_INFORMATION: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    RESPONDED: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    CLOSED: "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
  };
  return (
    <span className={`status-badge ${style[status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
      {REPORT_STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const style: Record<string, string> = {
    NORMAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    URGENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    CRITICAL: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
  };
  return (
    <span className={`status-badge ${style[urgency] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
      {URGENCY_LABELS[urgency] ?? urgency}
    </span>
  );
}

export function AnonymousBadge({ isAnonymous }: { isAnonymous: boolean }) {
  return isAnonymous ? (
    <span className="status-badge bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
      Anonymous
    </span>
  ) : (
    <span className="status-badge bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
      Identified
    </span>
  );
}
