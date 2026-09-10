"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "../../AdminAuthProvider";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const ROLE_LEVEL: Record<string, number> = { SUPER_ADMIN: 3, CSO: 2, SECURITY_OFFICER: 1 };

export default function AdminUsersPage() {
  const { admin } = useAdmin();
  const isSuper = admin?.role === "SUPER_ADMIN";
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("CSO");
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.users && setUsers(d.users))
      .catch(() => {});
  }, []);

  if (!isSuper) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">
        Only Super Admins can manage administrator users.
      </div>
    );
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, role })
    });
    const d = await res.json();
    if (!res.ok) return setError(d.error || "Failed.");
    setUsers((p) => [...p, d.user]);
    setName(""); setEmail(""); setPassword(""); setRole("CSO");
    setMsg("User created.");
  };

  const toggleActive = async (u: User) => {
    if (u.id === admin?.id) return;
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: u.id, isActive: !u.isActive })
    });
    const d = await res.json();
    if (res.ok) setUsers((p) => p.map((x) => (x.id === u.id ? d.user : x)));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">Administrator Users</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Manage security personnel accounts.</p>
      </div>

      <form onSubmit={create} className="card space-y-2 p-4">
        <span className="label">Create administrator</span>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required maxLength={120} />
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required maxLength={200} />
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8)" required minLength={8} maxLength={200} />
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="CSO">Chief Security Officer</option>
            <option value="SECURITY_OFFICER">Security Officer</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
        </div>
        <button type="submit" className="btn-primary">Create User</button>
      </form>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-500/30 dark:bg-green-950/40 dark:text-green-300">{msg}</div>}

      <section className="card overflow-hidden">
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {u.name}
                  {u.id === admin?.id && <span className="ml-2 text-xs text-brand-600 dark:text-brand-400">(you)</span>}
                </div>
                <div className="text-xs text-gray-400">
                  {u.email} · {u.role.replace(/_/g, " ")}
                  {u.id === admin?.id && <span className={u.isActive ? "text-success-600 dark:text-success-400" : "text-gray-400"}> · {u.isActive ? "Active" : "Inactive"}</span>}
                </div>
              </div>
              {u.id !== admin?.id && (
                <button onClick={() => toggleActive(u)} className="btn-secondary py-1 text-xs">
                  {u.isActive ? "Deactivate" : "Activate"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
