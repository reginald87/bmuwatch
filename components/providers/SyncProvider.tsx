"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback
} from "react";
import { syncManager, SyncResult, SyncStatus } from "@/lib/client/syncManager";

interface SyncContextValue {
  status: SyncStatus;
  pending: number;
  lastRun: number;
  syncing: boolean;
  sync: (opts?: { manual?: boolean }) => Promise<SyncResult>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SyncStatus>("ONLINE");
  const [pending, setPending] = useState(0);
  const [lastRun, setLastRun] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = useCallback(async () => {
    setPending(await syncManager.countPending());
  }, []);

  useEffect(() => {
    setStatus(syncManager.getStatus());
    setLastRun(syncManager.getLastRun());
    refreshPending();

    const unsub = syncManager.subscribe((s) => {
      setStatus(s);
      setLastRun(syncManager.getLastRun());
      refreshPending();
    });
    refreshPending();

    // Trigger automatic sync: on mount (PWA start), on online, and when the
    // browser reports the app coming back to the foreground.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        syncManager.sync().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const onOnline = () => {
      syncManager.sync().catch(() => {});
    };
    window.addEventListener("online", onOnline);

    syncManager.sync().catch(() => {});
    return () => {
      unsub();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [refreshPending]);

  const sync = useCallback((opts?: { manual?: boolean }) => {
    setSyncing(true);
    return syncManager
      .sync(opts)
      .then((res) => {
        setLastRun(res.lastRun);
        setSyncing(false);
        refreshPending();
        return res;
      })
      .catch((e) => {
        setSyncing(false);
        refreshPending();
        throw e;
      });
  }, [refreshPending]);

  return (
    <SyncContext.Provider value={{ status, pending, lastRun, syncing, sync }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}
