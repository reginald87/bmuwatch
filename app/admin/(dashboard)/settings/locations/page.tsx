"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "../../AdminAuthProvider";

interface Loc {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
}

export default function AdminLocationsPage() {
  const { admin } = useAdmin();
  const canEdit = admin?.role === "SUPER_ADMIN" || admin?.role === "CSO";
  const [items, setItems] = useState<Loc[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/locations", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.locations && setItems(d.locations))
      .catch(() => {});
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const res = await fetch("/api/admin/locations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description })
    });
    const d = await res.json();
    if (!res.ok) return setError(d.error || "Failed.");
    setItems((p) => [...p, d.location].sort((a, b) => a.sortOrder - b.sortOrder));
    setName("");
    setDescription("");
    setMsg("Location created.");
  };

  const toggle = async (c: Loc) => {
    if (!canEdit) return;
    const res = await fetch("/api/admin/locations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, isActive: !c.isActive })
    });
    const d = await res.json();
    if (res.ok) setItems((p) => p.map((x) => (x.id === c.id ? d.location : x)));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">Security Locations</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Locations appear in the report form for students and staff.</p>
      </div>

      {canEdit && (
        <form onSubmit={create} className="card space-y-2 p-4">
          <span className="label">Add a location</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Location name" required maxLength={120} />
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" maxLength={300} />
          <button type="submit" className="btn-primary">Add Location</button>
        </form>
      )}

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-950/40 dark:text-green-300">{msg}</div>}

      <section className="card overflow-hidden">
        {items.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No locations.</div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</div>
                  <div className="text-xs text-gray-400">{c.description || "No description"}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium ${c.isActive ? "text-success-600 dark:text-success-400" : "text-gray-400"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                  {canEdit && (
                    <button onClick={() => toggle(c)} className="btn-secondary py-1 text-xs">
                      {c.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
