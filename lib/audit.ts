import { AuditAction } from "@prisma/client";
import { prisma } from "./db";

export async function writeAudit(input: {
  adminId: string;
  action: AuditAction;
  reportId?: string | null;
  detail?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        reportId: input.reportId ?? null,
        detail: input.detail ?? null
      }
    });
  } catch (e) {
    // Audit logging must never break the primary workflow.
    console.error("Audit log write failed:", e);
  }
}
