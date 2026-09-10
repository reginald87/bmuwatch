import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError, validateStrings } from "@/lib/validation";

// Admin security categories management. CSO and above.

export async function GET() {
  try {
    await requireRole("SECURITY_OFFICER");
    const categories = await prisma.securityCategory.findMany({
      orderBy: { sortOrder: "asc" }
    });
    return NextResponse.json({ categories });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole("CSO");
    const body = await req.json();
    const name = validateStrings(body.name, "name", { required: true, max: 120 });
    const description = body.description ? validateStrings(body.description, "description", { max: 300 }) : null;
    if (!name) throw new ApiError(400, "Category name is required.");
    const existing = await prisma.securityCategory.findUnique({ where: { name } });
    if (existing) throw new ApiError(409, "A category with this name already exists.");
    const count = await prisma.securityCategory.count();
    const category = await prisma.securityCategory.create({
      data: { name, description, sortOrder: count }
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireRole("CSO");
    const body = await req.json();
    const id = validateStrings(body.id, "id", { required: true, max: 64 });
    if (!id) throw new ApiError(400, "id is required.");
    const data: Record<string, any> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
      const dup = await prisma.securityCategory.findFirst({ where: { name: data.name, NOT: { id } } });
      if (dup) throw new ApiError(409, "A category with this name already exists.");
    }
    if (typeof body.description === "string") data.description = body.description || null;
    if (typeof body.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body.sortOrder === "number") data.sortOrder = body.sortOrder;
    const category = await prisma.securityCategory.update({ where: { id }, data });
    return NextResponse.json({ category });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
