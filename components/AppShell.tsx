"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SyncIndicator from "./SyncIndicator";
import ThemeToggle from "./ThemeToggle";

// Shared shell for the student/staff PWA: header + bottom navigation + a
// floating sync button. Mobile-first with large touch targets.

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { href: "/", label: "Home", icon: "home", active: pathname === "/" },
    { href: "/report", label: "Report", icon: "report", active: pathname === "/report" },
    { href: "/reports", label: "My Reports", icon: "list", active: pathname.startsWith("/reports") || pathname === "/reports" },
    { href: "/how", label: "How It Works", icon: "info", active: pathname === "/how" }
  ];

  const iconPath: Record<string, React.ReactNode> = {
    home: (
      <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />
    ),
    report: (
      <>
        <path d="M12 3v12M7 14l5 5 5-5" transform="rotate(0)" />
      </>
    ),
    list: (
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    ),
    info: (
      <path d="M12 8h.01M12 12v5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z" />
    )
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-brand-50/40 to-white dark:from-brand-950/30 dark:to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-brand-900/10 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 text-white shadow-sm shadow-brand-900/10">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 shadow-inner">
              <img src="/icons/icon-192.png" alt="" className="h-7 w-7 rounded-md" />
            </span>
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-tight">BMU WATCH</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-brand-100/90">
                Keep BMU Safe
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <span className="hidden rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-brand-50 sm:inline">
              Bayelsa Medical University
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-28 pt-5">{children}</main>

      {/* Emergency disclaimer */}
      <div className="mx-auto w-full max-w-lg px-4 pb-24">
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-800 backdrop-blur dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
          🚨 <strong>BMU WATCH</strong> is for reporting security concerns and does
          not replace emergency assistance. If you are in immediate danger, contact
          the University&apos;s security/emergency personnel directly.
        </div>
      </div>

      {/* Floating sync button */}
      <SyncIndicator />

      {/* Bottom navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-brand-900/10 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-brand-500/20 dark:bg-gray-900/90"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-3 py-2 transition-colors ${
                item.active
                  ? "text-brand-700 dark:text-brand-300"
                  : "text-gray-400 hover:text-brand-600 dark:text-gray-500 dark:hover:text-brand-300"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={item.active ? 2.4 : 1.9}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {iconPath[item.icon]}
              </svg>
              <span className="text-[11px] font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
