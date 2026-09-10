import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { changeStatus } from "@/lib/reportService";
import { ApiError, validateStatusTransition } from "@/lib/validation";

// CSO/admin status change. Records a status history entry + audit log.

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("SECURITY_OFFICER");
    const { id } = await params;
    const body = await req.json();
    const toStatus = validateStatusTransition(body.status);
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

    const updated = await changeStatus(id, toStatus as any, session.id, note);
    return NextResponse.json({ report: updated });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST admin status error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
