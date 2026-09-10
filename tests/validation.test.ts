import { describe, it, expect } from "vitest";
import {
  validateReportCreate,
  ValidationError,
  validateStatusTransition,
  ALLOWED_MIME
} from "../lib/validation";

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    clientSubmissionId: "abc-123",
    installationId: "inst-1",
    reporterType: "STUDENT",
    isAnonymous: false,
    categoryName: "Suspicious Activity",
    locationName: "Main Campus",
    urgency: "NORMAL",
    description: "Something suspicious happened at the gate.",
    attachments: [],
    ...overrides
  };
}

describe("validateReportCreate", () => {
  it("accepts a valid identified student report", () => {
    const result = validateReportCreate(
      basePayload({ studentId: "BMU/2023/001", fullName: "Ada Obi", email: "ada@example.com" })
    );
    expect(result.reporterType).toBe("STUDENT");
    expect(result.fullName).toBe("Ada Obi");
    expect(result.studentId).toBe("BMU/2023/001");
  });

  it("strips identifying fields when anonymous (privacy at the API boundary)", () => {
    const result = validateReportCreate(
      basePayload({
        isAnonymous: true,
        fullName: "Secret Person",
        studentId: "BMU/999",
        email: "secret@example.com",
        phone: "08012345678"
      })
    );
    expect(result.isAnonymous).toBe(true);
    expect(result.fullName).toBeNull();
    expect(result.studentId).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
  });

  it("supports staff reports", () => {
    const result = validateReportCreate(
      basePayload({ reporterType: "STAFF", staffId: "BMU/STAFF/014" })
    );
    expect(result.reporterType).toBe("STAFF");
    expect(result.staffId).toBe("BMU/STAFF/014");
  });

  it("rejects missing description", () => {
    expect(() => validateReportCreate(basePayload({ description: "" }))).toThrow(ValidationError);
  });

  it("rejects invalid urgency", () => {
    expect(() => validateReportCreate(basePayload({ urgency: "EXTREME" }))).toThrow(ValidationError);
  });

  it("rejects invalid reporter type", () => {
    expect(() => validateReportCreate(basePayload({ reporterType: "ALIEN" }))).toThrow(
      ValidationError
    );
  });

  it("rejects missing clientSubmissionId", () => {
    expect(() =>
      validateReportCreate({ ...basePayload(), clientSubmissionId: "" })
    ).toThrow(ValidationError);
  });

  it("rejects disallowed attachment mime types", () => {
    expect(() =>
      validateReportCreate(
        basePayload({
          attachments: [{ fileName: "virus.exe", mimeType: "application/x-msdownload", sizeBytes: 100, dataBase64: "" }]
        })
      )
    ).toThrow(ValidationError);
  });

  it("rejects oversized attachments", () => {
    expect(() =>
      validateReportCreate(
        basePayload({
          attachments: [{ fileName: "big.pdf", mimeType: "application/pdf", sizeBytes: 9 * 1024 * 1024, dataBase64: "" }]
        })
      )
    ).toThrow(ValidationError);
  });

  it("allows valid image/pdf attachments", () => {
    const result = validateReportCreate(
      basePayload({
        attachments: [
          { fileName: "photo.jpg", mimeType: "image/jpeg", sizeBytes: 1024, dataBase64: "aGVsbG8=" }
        ]
      })
    );
    expect(result.attachments).toHaveLength(1);
  });

  it("rejects invalid email", () => {
    expect(() =>
      validateReportCreate(basePayload({ email: "not-an-email" }))
    ).toThrow(ValidationError);
  });
});

describe("validateStatusTransition", () => {
  it("accepts valid statuses", () => {
    expect(validateStatusTransition("RESOLVED")).toBe("RESOLVED");
    expect(validateStatusTransition("CLOSED")).toBe("CLOSED");
  });
  it("rejects invalid / client-only statuses", () => {
    expect(() => validateStatusTransition("PENDING_SYNC")).toThrow(ValidationError);
    expect(() => validateStatusTransition("whatever")).toThrow(ValidationError);
  });
});

describe("ALLOWED_MIME", () => {
  it("allows safe types and excludes executables", () => {
    expect(ALLOWED_MIME.has("image/png")).toBe(true);
    expect(ALLOWED_MIME.has("application/pdf")).toBe(true);
    expect(ALLOWED_MIME.has("application/x-msdownload")).toBe(false);
  });
});
