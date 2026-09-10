import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Public list of active security categories, cached client-side for offline use.
// Non-sensitive reference data.

export async function GET() {
  const categories = await prisma.securityCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, description: true, isActive: true }
  });
  return NextResponse.json({ categories });
}
