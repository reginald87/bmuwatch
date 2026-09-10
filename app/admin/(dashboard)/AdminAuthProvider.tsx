"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AdminRole } from "@/lib/types";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

interface AuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/me", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setAdmin(data.admin ?? null);
        if (!data.admin) {
          router.replace("/admin/login");
        }
      })
      .catch(() => {
        if (!active) return;
        router.replace("/admin/login");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    setAdmin(null);
    router.replace("/admin/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!admin) return null;

  return (
    <AuthContext.Provider value={{ admin, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdmin(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAdmin must be used within AdminAuthProvider");
  return ctx;
}
