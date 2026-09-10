import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { AdminRole } from "./types";

const SESSION_COOKIE = "bmu_admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.JWT_SECRET || "insecure-default-secret";
  return new TextEncoder().encode(secret);
}

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
}

export async function createSessionToken(session: AdminSession): Promise<string> {
  return new SignJWT({ name: session.name, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub || !payload.role) return null;
    return {
      id: payload.sub,
      name: typeof payload.name === "string" ? payload.name : "",
      email: typeof payload.email === "string" ? payload.email : "",
      role: payload.role as AdminRole
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(session: AdminSession): Promise<void> {
  const token = await createSessionToken(session);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// Reads the current admin session from the cookie (server-side only).
export async function getSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Requires an authenticated admin; throws an ApiError otherwise.
export async function requireAuth(): Promise<AdminSession> {
  const session = await getSession();
  if (!session) {
    const { ApiError } = await import("./validation");
    throw new ApiError(401, "Authentication required.");
  }
  return session;
}

const ROLE_LEVEL: Record<AdminRole, number> = {
  SUPER_ADMIN: 3,
  CSO: 2,
  SECURITY_OFFICER: 1
};

export function hasRole(session: AdminSession, role: AdminRole): boolean {
  return ROLE_LEVEL[session.role] >= ROLE_LEVEL[role];
}

// Requires the session role to be at least `role`.
export async function requireRole(role: AdminRole): Promise<AdminSession> {
  const session = await requireAuth();
  if (!hasRole(session, role)) {
    const { ApiError } = await import("./validation");
    throw new ApiError(403, "You do not have permission to perform this action.");
  }
  return session;
}
