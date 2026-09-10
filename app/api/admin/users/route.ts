import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireRole, getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, validateStrings } from "@/lib/validation";
import { ADMIN_ROLES } from "@/lib/types";

// Admin users management. Listing: CSO+. Create/update: SUPER_ADMIN only.

export async function GET() {
  try {
    await requireRole("SECURITY_OFFICER");
    const users = await prisma.adminUser.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
    });
    return NextResponse.json({ users });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");
    const body = await req.json();
    const name = validateStrings(body.name, "name", { required: true, max: 120 });
    const email = validateStrings(body.email, "email", { required: true, max: 200 }).toLowerCase();
    const password = validateStrings(body.password, "password", { required: true, max: 200 });
    if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters.");
    const role = validateStrings(body.role, "role", { required: true, max: 30 });
    if (!(ADMIN_ROLES as readonly string[]).includes(role)) throw new ApiError(400, "Invalid role.");
    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) throw new ApiError(409, "A user with this email already exists.");
    const user = await prisma.adminUser.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12), role: role as any }
    });
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }
    }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN");
    const session = await getSession();
    const body = await req.json();
    const id = validateStrings(body.id, "id", { required: true, max: 64 });
    if (!id) throw new ApiError(400, "id is required.");
    const data: Record<string, any> = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.role === "string" && (ADMIN_ROLES as readonly string[]).includes(body.role)) {
      data.role = body.role;
    }
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body.password === "string" && body.password.trim().length >= 8) {
      data.passwordHash = await bcrypt.hash(body.password.trim(), 12);
    }
    // Prevent demoting/deactivating the last super admin.
    if (data.role && data.role !== "SUPER_ADMIN" && session?.id === id) {
      const superAdmins = await prisma.adminUser.count({ where: { role: "SUPER_ADMIN" } });
      if (superAdmins <= 1) throw new ApiError(400, "Cannot remove the last super admin.");
    }
    const user = await prisma.adminUser.update({ where: { id }, data });
    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive }
    });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
