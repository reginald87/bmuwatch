import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/validation";

// Lightweight dashboard stats for the CSO dashboard.

export async function GET() {
  try {
    await requireAuth();
    const [
      total,
      unread,
      urgent,
      critical,
      open,
      underInvestigation,
      awaitingInformation,
      resolved,
      closed,
      student,
      staff,
      anonymous,
      identified
    ] = await Promise.all([
      prisma.securityReport.count(),
      prisma.securityReport.count({ where: { status: { in: ["SUBMITTED", "RECEIVED", "READ_BY_CSO"] } } }),
      prisma.securityReport.count({ where: { urgency: "URGENT", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.securityReport.count({ where: { urgency: "CRITICAL", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.securityReport.count({ where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.securityReport.count({ where: { status: "UNDER_INVESTIGATION" } }),
      prisma.securityReport.count({ where: { status: "AWAITING_INFORMATION" } }),
      prisma.securityReport.count({ where: { status: "RESOLVED" } }),
      prisma.securityReport.count({ where: { status: "CLOSED" } }),
      prisma.securityReport.count({ where: { reporterType: "STUDENT" } }),
      prisma.securityReport.count({ where: { reporterType: "STAFF" } }),
      prisma.securityReport.count({ where: { isAnonymous: true } }),
      prisma.securityReport.count({ where: { isAnonymous: false } })
    ]);

    return NextResponse.json({
      stats: {
        total, unread, urgent, critical, open, underInvestigation,
        awaitingInformation, resolved, closed, student, staff, anonymous, identified
      }
    });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
