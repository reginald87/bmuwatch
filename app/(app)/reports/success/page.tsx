"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SuccessContent() {
  const params = useSearchParams();
  const ref = params.get("ref");

  return (
    <div className="flex flex-col items-center space-y-4 pt-10 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl dark:bg-emerald-900/40">
        ✅
      </div>
      <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">Report Saved</h1>
      <p className="max-w-sm text-sm text-gray-600 dark:text-gray-400">
        Your report has been saved on this device and will be sent automatically
        when your connection is restored.
      </p>
      <div className="w-full max-w-sm rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-950/40 dark:text-brand-200">
        <p className="font-medium">
          You can track this report under{" "}
          <span className="font-semibold">My Reports</span>.
        </p>
        {ref && <p className="mt-2 break-all text-xs opacity-70">Local ID: {ref}</p>}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Link href="/reports" className="btn-primary w-full">
          View My Reports
        </Link>
        <Link href="/" className="btn-secondary w-full">
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export default function ReportSuccessPage() {
  return (
    <Suspense fallback={<div className="pt-16 text-center text-sm text-gray-400">Loading…</div>}>
      <SuccessContent />
    </Suspense>
  );
}
