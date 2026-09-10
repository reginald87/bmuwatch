import { NextRequest, NextResponse } from "next/server";
import { addUserResponseByClient } from "@/lib/reportService";
import { ApiError, validateStrings } from "@/lib/validation";

// Public (client) endpoint to submit a reporter reply to their own report.
// Association is proven via clientSubmissionId + installationId.
// Response body is idempotent-safe by not being retried after success.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const clientSubmissionId = validateStrings(body.clientSubmissionId, "clientSubmissionId", { required: true, max: 64 });
    const installationId = validateStrings(body.installationId, "installationId", { required: true, max: 64 });
    const text = validateStrings(body.body, "body", { required: true, max: 2000 });
    if (!text) throw new ApiError(400, "Message body is required.");

    const response = await addUserResponseByClient(clientSubmissionId, installationId, text);

    return NextResponse.json({
      response: {
        id: response.id,
        isFromAdmin: false,
        body: response.body,
        createdAt: response.createdAt
      }
    }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/reports/my/response error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
