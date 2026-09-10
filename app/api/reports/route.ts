import { NextRequest, NextResponse } from "next/server";
import { receiveReport } from "@/lib/reportService";
import { validateReportCreate, ApiError } from "@/lib/validation";

// Public endpoint used by the client sync engine to submit reports.
// Idempotent on clientSubmissionId: repeated submissions return the existing
// report and never create duplicates.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const payload = validateReportCreate(body);
    const result = await receiveReport(payload);

    const report = prismaToPublic(result.report);

    if (result.duplicated) {
      return NextResponse.json({ report, duplicated: true }, { status: 200 });
    }
    return NextResponse.json({ report, duplicated: false, created: true }, { status: 201 });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("POST /api/reports error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

// Client-safe shape (anonymous reports expose no identifying fields).
function prismaToPublic(report: any) {
  return {
    id: report.id,
    clientSubmissionId: report.clientSubmissionId,
    serverReference: report.serverReference,
    reporterType: report.reporterType,
    isAnonymous: report.isAnonymous,
    category: report.category?.name,
    location: report.location?.name,
    urgency: report.urgency,
    incidentDate: report.incidentDate,
    incidentTime: report.incidentTime,
    description: report.description,
    additionalInfo: report.additionalInfo,
    status: report.status,
    createdAt: report.createdAt,
    attachments: (report.attachments ?? []).map((a: any) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes
    })),
    responses: (report.responses ?? []).map((r: any) => ({
      id: r.id,
      isFromAdmin: r.isFromAdmin,
      authorName: r.isFromAdmin ? r.authorName : null,
      body: r.body,
      createdAt: r.createdAt
    }))
  };
}
