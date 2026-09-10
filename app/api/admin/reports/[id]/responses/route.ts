import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { addResponse } from "@/lib/reportService";
import { ApiError, validateStrings } from "@/lib/validation";

// CSO/admin replies to a report (two-way communication).

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole("SECURITY_OFFICER");
    const { id } = await params;
    const body = await req.json();
    const text = validateStrings(body.body, "body", { required: true, max: 2000 });
    if (!text) throw new ApiError(400, "Response body is required.");

    const response = await addResponse(id, {
      isFromAdmin: true,
      authorName: session.name,
      body: text
    }, session.id);

    return NextResponse.json({ response }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST admin response error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
