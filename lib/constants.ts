// Human-readable labels for statuses, urgencies, and roles.

export const REPORT_STATUS_LABELS: Record<string, string> = {
  PENDING_SYNC: "Pending Sync",
  SUBMITTED: "Submitted",
  RECEIVED: "Report Received",
  READ_BY_CSO: "Read by CSO",
  UNDER_INVESTIGATION: "Under Investigation",
  AWAITING_INFORMATION: "Awaiting Information",
  RESPONDED: "CSO Responded",
  RESOLVED: "Resolved",
  CLOSED: "Closed"
};

export const URGENCY_LABELS: Record<string, string> = {
  NORMAL: "Normal",
  URGENT: "Urgent",
  CRITICAL: "Critical"
};

export const REPORTER_LABELS: Record<string, string> = {
  STUDENT: "Student",
  STAFF: "Staff"
};

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  CSO: "Chief Security Officer",
  SECURITY_OFFICER: "Security Officer"
};

// Statuses the CSO may set a report to.
export const ADMIN_EDITABLE_STATUSES = [
  "RECEIVED",
  "READ_BY_CSO",
  "UNDER_INVESTIGATION",
  "AWAITING_INFORMATION",
  "RESPONDED",
  "RESOLVED",
  "CLOSED"
];
