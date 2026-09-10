import Link from "next/link";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center space-y-4 pt-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-4xl dark:bg-gray-800">
        📡
      </div>
      <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">You&apos;re Offline</h1>
      <p className="max-w-sm text-sm text-gray-600 dark:text-gray-400">
        BMU WATCH still works without internet. You can create a report now —
        it will be saved on this device and synced automatically when your
        connection returns.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Link href="/report" className="btn-primary w-full">
          Report a Security Concern
        </Link>
        <Link href="/reports" className="btn-secondary w-full">
          View My Reports
        </Link>
      </div>
    </div>
  );
}
