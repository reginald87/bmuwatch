import { db } from "./db";

// A random, stable installation identifier generated on first launch.
// This is used ONLY for local report association and synchronization, never
// as an identity, never for authentication, and never as personal data.

const INSTALLATION_KEY = "installationId";

export function cryptoRandomUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getInstallationId(): Promise<string> {
  const existing = await db.meta.get(INSTALLATION_KEY);
  if (existing) return existing.value;
  const id = cryptoRandomUuid();
  await db.meta.put({ key: INSTALLATION_KEY, value: id });
  return id;
}
