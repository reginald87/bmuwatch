import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/validation";

// Audit log. CSO and above can view the full log.

export async function GET(req: NextRequest) {
  try {
    const session = await requireRole("CSO");
    const search = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(search.get("page") ?? "1", 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(search.get("perPage") ?? "50", 10) || 50));
    const reportFilter = search.get("reportId");

    const where = session.role === "SUPER_ADMIN"
      ? (reportFilter ? { reportId: reportFilter } : {})
      : (reportFilter ? { reportId: reportFilter } : {});

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * perPage,
        take: perPage,
        include: {
          admin: { select: { name: true, email: true } },
          report: { select: { serverReference: true } }
        }
      })
    ]);

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        detail: l.detail,
        adminName: l.admin?.name ?? null,
        reportReference: l.report?.serverReference ?? null,
        createdAt: l.createdAt
      })),
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage)
    });
  } catch (e) {
    if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
