"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomePage() {
  const [installEvt, setInstallEvt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", () => setInstalled(true));
    };
  }, []);

  const inviteInstall = async () => {
    if (installEvt) {
      installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvt(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="card overflow-hidden p-6 text-center shadow-md">
        <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 shadow-lg shadow-brand-700/30 ring-4 ring-brand-100">
          <img src="/icons/icon-192.png" alt="BMU WATCH logo" className="h-16 w-16 rounded-2xl" />
        </div>
        <h1 className="bg-gradient-to-r from-brand-800 to-brand-600 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
          BMU WATCH
        </h1>
        <p className="mt-2 text-lg font-medium text-brand-700 dark:text-brand-300">
          See it. Report it. Keep BMU Safe.
        </p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Bayelsa Medical University · Campus Security
        </p>
      </section>

      {/* Installation prompt */}
      {installEvt && !installed && (
        <button onClick={inviteInstall} className="btn-primary w-full">
          📲 Add BMU WATCH to your device
        </button>
      )}

      {/* Primary CTA */}
      <section>
        <Link href="/report" className="btn-primary w-full py-4 text-base shadow-lg shadow-brand-700/25">
          <span aria-hidden>⚠️</span> Report a Security Concern
        </Link>
      </section>

      {/* Secondary actions */}
      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/reports"
          className="card flex flex-col items-center gap-2 p-5 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:hover:border-brand-600 dark:hover:bg-brand-900/30"
        >
          <span className="text-3xl" aria-hidden>📋</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">My Reports</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Track submitted reports</span>
        </Link>
        <Link
          href="/how"
          className="card flex flex-col items-center gap-2 p-5 text-center transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:hover:border-brand-600 dark:hover:bg-brand-900/30"
        >
          <span className="text-3xl" aria-hidden>ℹ️</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">How It Works</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">Learn how reporting works</span>
        </Link>
      </section>

      {/* Tips */}
      <section className="card border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 dark:border-brand-900/60 dark:from-brand-950/40 dark:to-gray-900">
        <h2 className="text-sm font-bold text-brand-900 dark:text-brand-200">Quick tips</h2>
        <ul className="mt-2 space-y-1.5 text-sm text-gray-600 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-brand-600">✓</span> Works even without internet — sync is automatic.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-600">✓</span> You can submit anonymously if you prefer.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-brand-600">✓</span> For immediate danger, contact security directly.
          </li>
        </ul>
      </section>

    </div>
  );
}
