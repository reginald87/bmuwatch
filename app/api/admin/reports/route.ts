import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { adminReportDto } from "@/lib/adminDto";
import { ApiError } from "@/lib/validation";
import { SERVER_STATUSES, URGENCY_LEVELS } from "@/lib/types";

// Admin report inbox + dashboard stats.
// Authenticated only. Supports filtering, sorting, pagination.

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const search = req.nextUrl.searchParams;

    // --- Filters ---
    const where: Record<string, any> = {};
    const category = search.get("category");
    const status = search.get("status");
    const urgency = search.get("urgency");
    const reporterType = search.get("reporterType");
    const anonymity = search.get("anonymity");
    const location = search.get("location");
    const from = search.get("from");
    const to = search.get("to");
    const q = search.get("q");

    if (category) where.categoryId = category;
    if (status && (SERVER_STATUSES as readonly string[]).includes(status)) where.status = status;
    if (urgency && (URGENCY_LEVELS as readonly string[]).includes(urgency)) where.urgency = urgency;
    if (reporterType === "STUDENT" || reporterType === "STAFF") where.reporterType = reporterType;
    if (anonymity === "ANONYMOUS") where.isAnonymous = true;
    if (anonymity === "IDENTIFIED") where.isAnonymous = false;
    if (location) where.locationId = location;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    if (q) {
      where.OR = [
        { serverReference: { contains: q } },
        { description: { contains: q } }
      ];
    }

    // --- Sorting ---
    const sortOpt = search.get("sort") ?? "newest";
    let orderBy: any = { createdAt: "desc" };
    if (sortOpt === "oldest") orderBy = { createdAt: "asc" };
    else if (sortOpt === "urgency") {
      orderBy = [
        { urgency: "desc" },
        { createdAt: "desc" }
      ];
    }

    // --- Pagination ---
    const page = Math.max(1, parseInt(search.get("page") ?? "1", 10) || 1);
    const perPage = Math.min(50, Math.max(1, parseInt(search.get("perPage") ?? "20", 10) || 20));

    const [total, reports, stats] = await Promise.all([
      prisma.securityReport.count({ where }),
      prisma.securityReport.findMany({
        where,
        orderBy,
        skip: (page - 1) * perPage,
        take: perPage,
        include: { category: true, location: true }
      }),
      buildStats()
    ]);

    return NextResponse.json({
      reports: reports.map(adminReportDto),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      stats
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET /api/admin/reports error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}

async function buildStats() {
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
  return {
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
  };
}
