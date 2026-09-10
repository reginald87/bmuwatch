import { SecurityReport } from "@prisma/client";

// Admin-facing report DTO. Privacy rule: anonymous reports NEVER expose
// identifying fields, regardless of how the frontend is built.

export function adminReportDto(report: any) {
  const base = {
    id: report.id,
    serverReference: report.serverReference,
    reporterType: report.reporterType,
    isAnonymous: report.isAnonymous,
    category: report.category?.name,
    categoryId: report.categoryId,
    location: report.location?.name,
    locationId: report.locationId,
    urgency: report.urgency,
    incidentDate: report.incidentDate,
    incidentTime: report.incidentTime,
    description: report.description,
    additionalInfo: report.additionalInfo,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
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
    })),
    assignments: (report.assignments ?? []).map((a: any) => ({
      id: a.id,
      assignee: a.assignee?.name ?? null,
      assignedBy: a.assignedBy?.name ?? null,
      note: a.note,
      assignedAt: a.assignedAt
    })),
    statusHistory: (report.statusHistory ?? []).map((h: any) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      adminName: h.admin?.name ?? null,
      note: h.note,
      createdAt: h.createdAt
    }))
  };

  if (report.isAnonymous) {
    return {
      ...base,
      submittedBy: "Anonymous",
      fullName: null,
      studentId: null,
      staffId: null,
      department: null,
      faculty: null,
      email: null,
      phone: null
    };
  }
  return {
    ...base,
    submittedBy: report.fullName ?? "Identified",
    fullName: report.fullName,
    studentId: report.studentId,
    staffId: report.staffId,
    idNumber: report.studentId ?? report.staffId,
    department: report.department,
    faculty: report.faculty,
    email: report.email,
    phone: report.phone
  };
}
