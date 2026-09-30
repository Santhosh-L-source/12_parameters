"use client";

import { useState, useCallback, useRef } from "react";
import type { VerificationResult } from "@/lib/verifier";

const DECISION_CONFIG: Record<
  string,
  { label: string; bg: string; border: string; text: string; icon: string }
> = {
  approved_verified: {
    label: "Approved & Verified",
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-800",
    icon: "✓",
  },
  approved_incomplete: {
    label: "Approved — Verification Incomplete",
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    text: "text-yellow-800",
    icon: "⚠",
  },
  refer_to_mentor: {
    label: "Refer to Mentor",
    bg: "bg-orange-50",
    border: "border-orange-300",
    text: "text-orange-800",
    icon: "→",
  },
  not_approved: {
    label: "Not an Approved Assessment",
    bg: "bg-red-50",
    border: "border-red-300",
    text: "text-red-800",
    icon: "✗",
  },
  excluded: {
    label: "Excluded (Belongs to Parameter 9)",
    bg: "bg-blue-50",
    border: "border-blue-300",
    text: "text-blue-800",
    icon: "ⓘ",
  },
};

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4 py-2 border-b border-gray-100 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 sm:w-44 shrink-0">
        {label}
      </span>
      <span className="text-sm text-gray-800 break-all">{value}</span>
    </div>
  );
}

function MatchBadge({
  status,
  labels,
}: {
  status: string;
  labels: { match: string; mismatch: string; unverified: string; not_provided?: string };
}) {
  const cfg: Record<string, string> = {
    match: "bg-green-100 text-green-700",
    mismatch: "bg-red-100 text-red-700",
    unverified: "bg-gray-100 text-gray-600",
    not_provided: "bg-gray-100 text-gray-400",
  };
  const text =
    status === "match"
      ? labels.match
      : status === "mismatch"
      ? labels.mismatch
      : status === "not_provided"
      ? labels.not_provided ?? "Not Provided"
      : labels.unverified;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        cfg[status] ?? cfg.unverified
      }`}
    >
      {text}
    </span>
  );
}

function PdfIcon() {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-12 h-14 bg-red-100 rounded border-2 border-red-300 flex items-center justify-center">
        <span className="text-red-600 text-xs font-bold">PDF</span>
      </div>
      <span className="text-xs text-gray-500">PDF uploaded</span>
    </div>
  );
}

function ResultCard({ result }: { result: VerificationResult }) {
  const cfg = DECISION_CONFIG[result.decision] ?? DECISION_CONFIG.refer_to_mentor;

  return (
    <div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-6 space-y-5`}>
      {/* Decision header */}
      <div className="flex items-start gap-3">
        <span className={`text-2xl font-bold ${cfg.text} leading-none mt-0.5`}>{cfg.icon}</span>
        <div>
          <p className={`text-lg font-bold ${cfg.text}`}>{cfg.label}</p>
          <p className="text-sm text-gray-600 mt-0.5">{result.reason}</p>
        </div>
      </div>

      {/* Certificate details */}
      <div className="bg-white rounded-lg p-4 border border-gray-100">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
          Certificate Details
        </p>
        <Row label="Type" value={result.classification} />
        <Row label="Provider" value={result.provider} />
        <Row label="Assessment" value={result.assessment_name} />
        <Row label="Score / Level" value={result.score} />
        <Row label="Test Date" value={result.test_date} />
        <Row label="Credential ID" value={result.credential_id} />
        <Row label="Proctoring" value={result.proctoring_evidence} />
        <Row label="Exclusion Reason" value={result.exclusion_reason} />
      </div>

      {/* Name & Roll check */}
      <div className="bg-white rounded-lg p-4 border border-gray-100">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
          Identity Verification
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          <MatchBadge
            status={result.name_match}
            labels={{ match: "Name Match", mismatch: "Name Mismatch", unverified: "Name Unverified" }}
          />
          {result.roll_match && result.roll_match !== "not_provided" && (
            <MatchBadge
              status={result.roll_match}
              labels={{
                match: "Roll No. Match",
                mismatch: "Roll No. Mismatch",
                unverified: "Roll No. Unverified",
              }}
            />
          )}
        </div>
        <Row label="Name on Certificate" value={result.candidate_name} />
        <Row label="Roll No. on Certificate" value={result.roll_number_on_doc} />
        {result.name_match_note && (
          <p className="text-xs text-gray-500 mt-1">{result.name_match_note}</p>
        )}
        {result.roll_match_note && (
          <p className="text-xs text-gray-500 mt-0.5">{result.roll_match_note}</p>
        )}
      </div>

      {/* URL / QR verification */}
      {(result.url_found || result.qr_decoded_url || result.url_verification) && (
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
            URL / QR Verification
          </p>
          <Row label="URL on Certificate" value={result.url_found} />
          <Row label="QR Decoded URL" value={result.qr_decoded_url} />
          {result.url_verification && (
            <>
              <Row
                label="HTTP Status"
                value={
                  result.url_verification.status_code
                    ? String(result.url_verification.status_code)
                    : "Unreachable"
                }
              />
              <Row label="Final Domain" value={result.url_verification.domain_check} />
              <Row label="Page Title" value={result.url_verification.page_title} />
              {result.url_verification.final_url && (
                <Row label="Redirected To" value={result.url_verification.final_url} />
              )}
              <div className="mt-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    result.url_verification.is_official_domain
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {result.url_verification.is_official_domain
                    ? "Official Domain Confirmed"
                    : "Domain Not Recognised as Official"}
                </span>
                <p className="text-xs text-gray-500 mt-1">
                  {result.url_verification.domain_note}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Potential score */}
      {result.potential_score && (
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-1">
            Estimated Parameter 7 Score
          </p>
          <p className="text-sm text-gray-800">{result.potential_score}</p>
        </div>
      )}

      {/* Mentor checklist */}
      {result.mentor_checklist?.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-gray-100">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">
            Mentor Must Verify
          </p>
          <ul className="space-y-1">
            {result.mentor_checklist.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-gray-400 shrink-0">•</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif,application/pdf";
const ACCEPTED_EXTS = ".jpg,.jpeg,.png,.webp,.gif,.pdf";

export default function Home() {
  const [userName, setUserName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
      setIsPdf(true);
      setPreview(null);
    } else {
      setIsPdf(false);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(f);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !userName.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("certificate", file);
    formData.append("userName", userName.trim());
    formData.append("rollNumber", rollNumber.trim());

    try {
      const res = await fetch("/api/verify", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed");
      setResult(data as VerificationResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Certificate Verifier</h1>
          <p className="mt-1 text-gray-500">Parameter 7 — Aptitude &amp; Communication</p>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Left: Upload form */}
          <form
            onSubmit={onSubmit}
            className="md:col-span-3 bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Student Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Name as registered"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Roll Number
                  <span className="text-gray-400 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. 21CS001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Certificate File <span className="text-red-500">*</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragging
                    ? "border-blue-400 bg-blue-50"
                    : file
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {isPdf ? (
                  <PdfIcon />
                ) : preview ? (
                  <img
                    src={preview}
                    alt="Certificate preview"
                    className="max-h-48 mx-auto rounded object-contain"
                  />
                ) : (
                  <div className="space-y-1">
                    <p className="text-sm text-gray-500">
                      Drag &amp; drop or{" "}
                      <span className="text-blue-600 font-medium">click to upload</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      PDF, JPEG, PNG, WebP, GIF — max 20 MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES + "," + ACCEPTED_EXTS}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </div>
              {file && (
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-gray-500 truncate">{file.name}</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      setPreview(null);
                      setIsPdf(false);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-xs text-red-400 hover:text-red-600 ml-2 shrink-0"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !file || !userName.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12" cy="12" r="10"
                      stroke="currentColor" strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a8 8 0 010 16v-4a8 8 0 01-8-8z"
                    />
                  </svg>
                  Verifying…
                </span>
              ) : (
                "Verify Certificate"
              )}
            </button>
          </form>

          {/* Right: Info panel */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                Approved Aptitude
              </p>
              {["TCS iON NQT", "AMCAT", "CoCubes", "eLitmus pH Test", "Wheebox"].map((c) => (
                <p key={c} className="text-sm text-gray-700 py-0.5">• {c}</p>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                Approved Communication
              </p>
              {["Pearson Versant", "Cambridge Linguaskill", "Cambridge BEC"].map((c) => (
                <p key={c} className="text-sm text-gray-700 py-0.5">• {c}</p>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">
                Accepted Formats
              </p>
              {["PDF", "JPEG / JPG", "PNG", "WebP", "GIF"].map((f) => (
                <p key={f} className="text-sm text-gray-700 py-0.5">• {f}</p>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-red-100 p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-red-300 mb-2">
                Not Accepted
              </p>
              {[
                "GRE / TOEFL / IELTS / PTE (→ Param 9)",
                "College or coaching tests",
                "Practice / mock screenshots",
                "Course completion certificates",
              ].map((c) => (
                <p key={c} className="text-xs text-gray-500 py-0.5">• {c}</p>
              ))}
            </div>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div>
            <h2 className="text-lg font-bold text-gray-800 mb-3">Verification Result</h2>
            <ResultCard result={result} />
          </div>
        )}
      </div>
    </main>
  );
}
