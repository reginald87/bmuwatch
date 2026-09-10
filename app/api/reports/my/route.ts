import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/validation";

// Fetch a report belonging to this installation.
// The client proves association via clientSubmissionId + installationId.
// This is NOT authentication — it only lets a device retrieve reports it created.

export async function GET(req: NextRequest) {
  try {
    const search = req.nextUrl.searchParams;
    const clientSubmissionId = search.get("clientSubmissionId")?.trim() ?? "";
    const installationId = search.get("installationId")?.trim() ?? "";

    if (!clientSubmissionId || !installationId) {
      throw new ApiError(400, "clientSubmissionId and installationId are required.");
    }

    const report = await prisma.securityReport.findFirst({
      where: { clientSubmissionId, installationId },
      include: {
        category: true,
        location: true,
        attachments: true,
        responses: true
      }
    });

    if (!report) {
      return NextResponse.json({ report: null });
    }

    return NextResponse.json({
      report: {
        clientSubmissionId: report.clientSubmissionId,
        serverReference: report.serverReference,
        reporterType: report.reporterType,
        isAnonymous: report.isAnonymous,
        category: report.category?.name,
        location: report.location?.name,
        urgency: report.urgency,
        status: report.status,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
        responses: (report.responses ?? []).map((r) => ({
          id: r.id,
          isFromAdmin: r.isFromAdmin,
          authorName: r.isFromAdmin ? r.authorName : null,
          body: r.body,
          createdAt: r.createdAt
        }))
      }
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
