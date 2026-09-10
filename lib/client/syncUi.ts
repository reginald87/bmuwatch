"use client";

export function getSyncStatusLabel(status: string): string {
  switch (status) {
    case "ONLINE":
    case "SUCCESS":
      return "All Synced";
    case "OFFLINE":
      return "Offline";
    case "PENDING":
      return "Pending Sync";
    case "SYNCING":
      return "Syncing…";
    case "FAILED":
      return "Sync Failed";
    default:
      return status;
  }
}

export function statusToColor(status: string): string {
  switch (status) {
    case "ONLINE":
    case "SUCCESS":
      return "text-success-600";
    case "OFFLINE":
      return "text-gray-500";
    case "PENDING":
      return "text-warn-500";
    case "SYNCING":
      return "text-brand-600";
    case "FAILED":
      return "text-danger-600";
    default:
      return "text-gray-500";
  }
}
