import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getReportById, markViewed } from "@/lib/reportService";
import { adminReportDto } from "@/lib/adminDto";
import { ApiError } from "@/lib/validation";

// Admin report detail. Marks as read (READ_BY_CSO) on first view.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const report = await getReportById(id);
    if (!report) throw new ApiError(404, "Report not found.");
    await markViewed(report.id, session.id);
    const dto = adminReportDto(report);
    // Refresh after marking viewed.
    const updated = await getReportById(id);
    return NextResponse.json({ report: updated ? adminReportDto(updated) : dto });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET admin report error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
