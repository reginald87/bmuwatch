import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { ApiError, validateStrings } from "@/lib/validation";

// Simple in-memory rate limiter for login attempts (~5 per 10 minutes per email+IP).
const attempts = new Map<string, number[]>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const list = (attempts.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= 5) {
    attempts.set(key, list);
    return true;
  }
  list.push(now);
  attempts.set(key, list);
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = validateStrings(body.email, "email", { required: true, max: 200 }).toLowerCase();
    const password = validateStrings(body.password, "password", { required: true, max: 200 });
    if (!email || !password) throw new ApiError(400, "Email and password are required.");

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
    if (rateLimited(`${email}:${ip}`)) {
      throw new ApiError(429, "Too many login attempts. Please try again later.");
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      throw new ApiError(401, "Invalid credentials.");
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new ApiError(401, "Invalid credentials.");

    await setSessionCookie({
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    });

    return NextResponse.json({
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/admin/login error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
