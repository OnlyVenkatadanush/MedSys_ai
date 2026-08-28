import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchLabReports, uploadLabReport } from "@/services/clinicalService";
import type { LabReportRecord } from "@/types";

export const LabReports: React.FC = () => {
  const [reports, setReports] = useState<LabReportRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [titleInput, setTitleInput] = useState<string>("Blood Test & Metabolic Panel");

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await fetchLabReports("pat_01");
      setReports(data);
    } catch (err) {
      console.error("Failed to load lab reports", err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    try {
      setUploading(true);
      await uploadLabReport(titleInput, "pat_01", file);
      setFile(null);
      setTitleInput("");
      loadReports();
    } catch (err) {
      console.error("Failed to upload lab report", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Medical Document Vault"
        title="Lab Reports Storage"
        meta="Upload diagnostic reports (PDFs/Images). Automated OCR extracts key lab values and metrics."
      />

      <div className="px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
          <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
            Upload Report
          </h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Document Title:</label>
              <input
                type="text"
                required
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="e.g. Lipid Profile Report"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
              />
            </div>

            <div>
              <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Select File (PDF / Image):</label>
              <input
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full rounded-xl border border-hairline bg-bg-mist p-2 font-mono text-xs text-stone"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-bg-mist hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {uploading ? "Extracting & Uploading..." : "⚡ Upload & Run OCR Extractor"}
            </button>
          </form>
        </div>

        {/* Lab Reports Feed */}
        <div className="lg:col-span-2 rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
          <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
            Stored Lab Reports & Metrics
          </h2>

          {loading ? (
            <div className="py-8 text-center font-mono text-xs text-stone">Loading lab reports...</div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div key={report.id} className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-base text-ink font-semibold">{report.title}</span>
                    <span className="font-mono text-xs text-stone">
                      Uploaded: {new Date(report.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>

                  {report.extracted_text && (
                    <div className="rounded-lg border border-hairline bg-surface-card p-3 font-mono text-xs text-stone">
                      <span className="font-semibold text-teal-deep block mb-1">OCR Extracted Text Snippet:</span>
                      <p className="italic">{report.extracted_text}</p>
                    </div>
                  )}

                  {report.metrics && report.metrics.length > 0 && (
                    <div>
                      <span className="font-mono text-xs uppercase tracking-wider text-stone block mb-2">
                        Parsed Metrics:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {report.metrics.map((m, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs flex justify-between items-center ${
                              m.is_abnormal
                                ? "bg-clay-alert/10 border-clay-alert/30 text-clay-alert font-semibold"
                                : "bg-surface-card border-hairline text-ink"
                            }`}
                          >
                            <div>
                              <span className="font-semibold block">{m.name}</span>
                              <span className="font-mono text-[10px] text-stone">Ref: {m.reference_range || "N/A"}</span>
                            </div>
                            <span className="font-display font-bold text-sm">
                              {m.value} {m.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
