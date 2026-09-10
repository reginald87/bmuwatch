"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { AdminAuthProvider, useAdmin } from "./AdminAuthProvider";
import type { AdminRole } from "@/lib/types";

const navGroups: { title?: string; items: { href: string; label: string; icon: string; roles?: AdminRole[] }[] }[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: "📊" },
      { href: "/admin/inbox", label: "Report Inbox", icon: "📥" },
      { href: "/admin/audit", label: "Audit Log", icon: "🧾" }
    ]
  },
  {
    title: "Configuration",
    items: [
      { href: "/admin/settings/categories", label: "Categories", icon: "🏷️" },
      { href: "/admin/settings/locations", label: "Locations", icon: "📍" },
      { href: "/admin/settings/users", label: "Admin Users", icon: "👤", roles: ["SUPER_ADMIN"] }
    ]
  }
];

const ROLE_LEVEL: Record<AdminRole, number> = {
  SUPER_ADMIN: 3,
  CSO: 2,
  SECURITY_OFFICER: 1
};

function SidebarContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, logout } = useAdmin();

  const can = (roles?: AdminRole[]) => {
    if (!roles) return true;
    return roles.some((r) => ROLE_LEVEL[admin!.role] >= ROLE_LEVEL[r]);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:flex">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <img src="/icons/icon-192.png" alt="" className="h-6 w-6 rounded-md" />
          </span>
          <div>
            <div className="text-base font-bold text-brand-950 dark:text-brand-200">BMU WATCH</div>
            <div className="text-[11px] text-gray-400">Security Operations</div>
          </div>
        </div>
        <nav className="flex-1 space-y-6 p-4">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  {group.title}
                </div>
              )}
              <ul className="space-y-0.5">
                {group.items
                  .filter((item) => can(item.roles))
                  .map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                            active
                              ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
                              : "text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
                          }`}
                        >
                          <span aria-hidden>{item.icon}</span>
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-gray-100 p-4 dark:border-gray-800">
          <div className="mb-2 flex items-center justify-between">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-800 dark:text-gray-200">{admin!.name}</div>
              <div className="truncate text-xs text-gray-400">{admin!.role.replace(/_/g, " ")}</div>
            </div>
          </div>
          <button onClick={logout} className="btn-secondary w-full py-2 text-sm">
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1">
        {/* Mobile top bar */}
        <div className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <img src="/icons/icon-192.png" alt="" className="h-5 w-5 rounded" />
              </span>
              <span className="font-bold text-brand-950 dark:text-brand-200">BMU WATCH</span>
            </div>
            <button onClick={logout} className="text-sm text-gray-500 dark:text-gray-400">Sign Out</button>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
            {navGroups.flatMap((g) => g.items)
              .filter((item) => can(item.roles))
              .map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium ${
                      active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
          </nav>
        </div>
        <div className="p-4 lg:p-8">{children}</div>
      </div>
    </div>
  );
}

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <SidebarContent>{children}</SidebarContent>
    </AdminAuthProvider>
  );
}
