"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useReferenceData } from "@/hooks/useReferenceData";
import {
  createLocalReport,
  saveLocalAttachment
} from "@/lib/client/reportRepo";
import { useSync } from "@/components/providers/SyncProvider";
import { MAX_ATTACHMENTS } from "@/lib/validation";

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain"
];
const MAX_SIZE = 8 * 1024 * 1024;

function readFileAsBlob(file: File): Promise<Blob> {
  return Promise.resolve(file);
}

export default function ReportForm() {
  const router = useRouter();
  const { categories, locations } = useReferenceData(true);
  const { sync } = useSync();

  const [reporterType, setReporterType] = useState<"STUDENT" | "STAFF">("STUDENT");
  const [isAnonymous, setIsAnonymous] = useState(true);
  const [categoryName, setCategoryName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [urgency, setUrgency] = useState<"NORMAL" | "URGENT" | "CRITICAL">("NORMAL");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");

  // Identified fields
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [description, setDescription] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEnabled = useMemo(
    () => !!categoryName && !!locationName && description.trim().length >= 5 && !submitting,
    [categoryName, locationName, description, submitting]
  );

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    setFileError(null);
    const incoming = Array.from(list).slice(0, MAX_ATTACHMENTS);
    for (const f of incoming) {
      if (f.size > MAX_SIZE) {
        setFileError(`"${f.name}" exceeds the 8 MB limit.`);
        return;
      }
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const forbidden = ["exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "sh", "apk", "dll", "php", "jar", "py"];
      if (forbidden.includes(ext) || !ALLOWED.includes(f.type)) {
        setFileError(`"${f.name}" is not an allowed file type.`);
        return;
      }
    }
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_ATTACHMENTS));
  };

  const resetForm = () => {
    setReporterType("STUDENT");
    setIsAnonymous(true);
    setCategoryName("");
    setLocationName("");
    setUrgency("NORMAL");
    setIncidentDate("");
    setIncidentTime("");
    setFullName("");
    setIdNumber("");
    setFaculty("");
    setDepartment("");
    setEmail("");
    setPhone("");
    setDescription("");
    setAdditionalInfo("");
    setFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName || !locationName || description.trim().length < 5) return;
    setSubmitting(true);
    setError(null);
    try {
      const input = {
        reporterType,
        isAnonymous,
        // Do not include identified fields when anonymous (kept null by repo).
        fullName: isAnonymous ? null : fullName,
        studentId: isAnonymous ? null : reporterType === "STUDENT" ? idNumber : null,
        staffId: isAnonymous ? null : reporterType === "STAFF" ? idNumber : null,
        department: isAnonymous ? null : department,
        faculty: isAnonymous ? null : faculty,
        email: isAnonymous ? null : email,
        phone: isAnonymous ? null : phone,
        categoryId: "",
        categoryName,
        locationId: "",
        locationName,
        urgency,
        incidentDate: incidentDate || null,
        incidentTime: incidentTime || null,
        description: description.trim(),
        additionalInfo: additionalInfo.trim() || null,
        attachments: files.map((f, i) => ({
          clientFileId: `f-${Date.now()}-${i}`,
          fileName: f.name,
          mimeType: f.type || "application/octet-stream",
          sizeBytes: f.size
        }))
      };

      // Save locally (offline-first) — never blocks on network.
      const report = await createLocalReport(input);

      // Persist attachment blobs locally.
      for (let i = 0; i < files.length; i++) {
        const cfid = input.attachments[i].clientFileId;
        const blob = await readFileAsBlob(files[i]);
        await saveLocalAttachment(report.id, cfid, files[i], blob);
      }

      // Try to sync immediately if online; if offline the record stays Pending Sync.
      if (navigator.onLine) {
        try {
          await sync({ manual: true });
        } catch {
          // Ignore; report remains saved locally.
        }
      }

      resetForm();
      router.push(`/reports/success?ref=${encodeURIComponent(report.clientSubmissionId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong saving your report.");
    } finally {
      setSubmitting(false);
    }
  };

  const idLabel = reporterType === "STUDENT" ? "Matric / Student ID" : "Staff ID";
  const idPlaceholder = reporterType === "STUDENT" ? "e.g. BMU/2023/001" : "e.g. BMU/STAFF/014";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h1 className="text-2xl font-bold text-brand-950 dark:text-brand-200">Report a Security Concern</h1>
      <p className="-mt-3 text-sm text-gray-500 dark:text-gray-400">
        Your report is saved on your device first and synced automatically.
      </p>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Reporter type */}
      <section className="card p-4">
        <span className="label">I am a:</span>
        <div className="grid grid-cols-2 gap-2">
          {(["STUDENT", "STAFF"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setReporterType(t)}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                reporterType === t
                  ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                  : "border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {t === "STUDENT" ? "🎓 Student" : "🏥 Staff"}
            </button>
          ))}
        </div>
      </section>

      {/* Category */}
      <section className="card p-4">
        <span className="label">Report category</span>
        <select
          className="input"
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
        >
          <option value="">Select category…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
      </section>

      {/* Location */}
      <section className="card p-4">
        <span className="label">Location</span>
        <select
          className="input"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
        >
          <option value="">Select location…</option>
          {locations.map((l) => (
            <option key={l.id} value={l.name}>
              {l.name}
            </option>
          ))}
        </select>
      </section>

      {/* Urgency */}
      <section className="card p-4">
        <span className="label">Urgency</span>
        <div className="grid grid-cols-3 gap-2">
          {(["NORMAL", "URGENT", "CRITICAL"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUrgency(u)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                urgency === u
                  ? u === "CRITICAL"
                    ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40"
                    : u === "URGENT"
                    ? "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"
                  : "border-gray-300 bg-white text-gray-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
              }`}
            >
              {u === "CRITICAL" ? "🔴 Critical" : u === "URGENT" ? "🟠 Urgent" : "🟢 Normal"}
            </button>
          ))}
        </div>
      </section>

      {/* Incident date/time */}
      <section className="card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="label">Incident date</span>
            <input
              type="date"
              className="input"
              value={incidentDate}
              onChange={(e) => setIncidentDate(e.target.value)}
            />
          </div>
          <div>
            <span className="label">Approx. time</span>
            <input
              type="time"
              className="input"
              value={incidentTime}
              onChange={(e) => setIncidentTime(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Description */}
      <section className="card p-4">
        <label className="label" htmlFor="description">
          What happened?
        </label>
        <textarea
          id="description"
          className="input min-h-32 resize-y"
          placeholder="Describe the security concern in as much detail as you can…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={8000}
        />
        <div className="mt-1 text-right text-xs text-gray-400 dark:text-gray-500">{description.length}/8000</div>
      </section>

      {/* Additional info */}
      <section className="card p-4">
        <label className="label" htmlFor="additionalInfo">
          Optional additional information
        </label>
        <textarea
          id="additionalInfo"
          className="input min-h-20 resize-y"
          placeholder="Any other details that may help…"
          value={additionalInfo}
          onChange={(e) => setAdditionalInfo(e.target.value)}
          maxLength={4000}
        />
      </section>

      {/* Attachments */}
      <section className="card p-4">
        <span className="label">Attachments (optional)</span>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-6 text-center hover:border-brand-400 dark:border-gray-600 dark:hover:border-brand-400">
          <span className="text-2xl" aria-hidden>📎</span>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Tap to add images, PDF, or documents</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">Up to {MAX_ATTACHMENTS} files · 8 MB each</span>
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            accept={ALLOWED.join(",")}
          />
        </label>
        {fileError && <p className="mt-2 text-xs text-red-600">{fileError}</p>}
        {files.length > 0 && (
          <ul className="mt-3 space-y-2">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800">
                <span className="truncate text-gray-700 dark:text-gray-200">{f.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Remove file"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Anonymous toggle */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Submit anonymously</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isAnonymous
                ? "Your identity will not be shown to security personnel."
                : "Your details below will be shared with security personnel."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isAnonymous}
            onClick={() => setIsAnonymous((v) => !v)}
            className={`relative h-7 w-12 rounded-full transition-colors ${
              isAnonymous ? "bg-purple-500" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${
                isAnonymous ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </section>

      {/* Identified details (shown when not anonymous) */}
      {!isAnonymous && (
        <section className="card space-y-3 p-4">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">Your details</h3>
          <div>
            <span className="label">Full name</span>
            <input
              className="input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div>
            <span className="label">{idLabel}</span>
            <input
              className="input"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder={idPlaceholder}
            />
          </div>
          <div>
            <span className="label">Faculty / School / College</span>
            <input
              className="input"
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              placeholder="e.g. Basic Medical Sciences"
            />
          </div>
          <div>
            <span className="label">Department / Unit</span>
            <input
              className="input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="e.g. Anatomy"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="label">Email</span>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <span className="label">Phone</span>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08012345678"
              />
            </div>
          </div>
        </section>
      )}

      <button type="submit" className="btn-primary w-full py-4 text-base" disabled={!submitEnabled}>
        {submitting ? "Submitting…" : "Submit Report"}
      </button>
      <p className="text-center text-xs text-gray-400">
        Your report is stored on this device and sent when you&apos;re online.
      </p>
    </form>
  );
}
