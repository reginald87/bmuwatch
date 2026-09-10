import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { assignReport } from "@/lib/reportService";
import { ApiError, validateStrings } from "@/lib/validation";

// Assign a report to a security officer. CSO and above.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("CSO");
    const { id } = await params;
    const body = await req.json();
    const assigneeId = validateStrings(body.assigneeId, "assigneeId", { required: true, max: 64 });
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
    if (!assigneeId) throw new ApiError(400, "assigneeId is required.");

    const assignment = await assignReport(id, assigneeId, session.id, note);
    return NextResponse.json({ assignment }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST admin assign error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
