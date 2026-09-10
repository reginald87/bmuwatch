import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { attachmentPath } from "@/lib/reportService";
import { ApiError } from "@/lib/validation";
import fs from "fs/promises";
import path from "path";

// Protected attachment download. Requires authenticated admin and verifies the
// attachment belongs to the given report (IDOR protection).

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  try {
    await requireAuth();
    const { id, attachmentId } = await params;

    const attachment = await prisma.reportAttachment.findFirst({
      where: { id: attachmentId, reportId: id }
    });
    if (!attachment) throw new ApiError(404, "Attachment not found.");

    const filePath = attachmentPath(attachment.storageKey);
    let data: Buffer;
    try {
      data = await fs.readFile(filePath);
    } catch {
      throw new ApiError(404, "Attachment file not found on disk.");
    }

    const safeName = path.basename(attachment.fileName).replace(/[^\w.\- ]/g, "_");
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": attachment.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store"
      }
    });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("GET attachment error:", e);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
