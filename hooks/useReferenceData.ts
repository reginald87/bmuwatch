"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/client/db";
import type { CategoryDto, LocationDto } from "@/lib/client/db";

interface ReferenceData {
  categories: CategoryDto[];
  locations: LocationDto[];
  loading: boolean;
  error: string | null;
}

// Loads categories/locations from IndexedDB (offline cache) and refreshes from
// the server when online. Returns cached data immediately so the app works even
// before a successful network round-trip.
export function useReferenceData(doRefresh = false): ReferenceData {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromDb = useCallback(async () => {
    const [c, l] = await Promise.all([db.categories.toArray(), db.locations.toArray()]);
    const sortedC = [...c].sort((a, b) => (a.name < b.name ? -1 : 1));
    const sortedL = [...l].sort((a, b) => (a.name < b.name ? -1 : 1));
    setCategories(sortedC);
    setLocations(sortedL);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [catRes, locRes] = await Promise.all([
        fetch("/api/categories", { cache: "no-store" }),
        fetch("/api/locations", { cache: "no-store" })
      ]);
      if (catRes.ok && locRes.ok) {
        const catData = await catRes.json();
        const locData = await locRes.json();
        if (Array.isArray(catData.categories) && Array.isArray(locData.locations)) {
          await db.transaction("rw", db.categories, db.locations, async () => {
            await db.categories.clear();
            await db.locations.clear();
            await db.categories.bulkPut(catData.categories);
            await db.locations.bulkPut(locData.locations);
          });
          await loadFromDb();
        }
      }
    } catch {
      // Offline or unavailable — rely on cached IndexedDB data.
    } finally {
      setLoading(false);
    }
  }, [loadFromDb]);

  useEffect(() => {
    setLoading(true);
    loadFromDb().finally(() => setLoading(false));
    if (doRefresh || navigator.onLine) {
      refresh().catch(() => {});
    }
  }, [loadFromDb, refresh]);

  return { categories, locations, loading, error };
}
