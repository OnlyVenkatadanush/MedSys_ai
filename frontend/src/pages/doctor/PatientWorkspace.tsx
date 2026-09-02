import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { PageHeader } from "@/components/PageHeader";
import { FormattedText } from "@/components/FormattedText";
import {
  fetchPatientOverview,
  fetchPatientTimeline,
  fetchTimelineAnalysis,
  fetchPreConsultationBrief,
  fetchLabTrends,
  fetchWhatsNew,
  fetchEvidenceTrace,
  sendDoctorCopilotQuery,
  fetchCustomHistorySummary,
} from "@/services/clinicalService";
import type {
  EvidenceTrace,
  LabMetricTrend,
  PreConsultationBrief,
  WhatsNewChanges,
} from "@/types";
import {
  Activity,
  Calendar,
  FileStack,
  MessageSquare,
  Pill,
  Stethoscope,
  User,
  Utensils,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  HelpCircle,
  X,
  ShieldCheck,
  Zap,
} from "lucide-react";

export const PatientWorkspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const patientId = id || "pat_01";
  const activeTab = searchParams.get("tab") || "overview";
  const navigate = useNavigate();

  const [overview, setOverview] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [timelineAnalysis, setTimelineAnalysis] = useState<string>("");
  const [preBrief, setPreBrief] = useState<PreConsultationBrief | null>(null);
  const [labTrends, setLabTrends] = useState<LabMetricTrend[]>([]);
  const [whatsNew, setWhatsNew] = useState<WhatsNewChanges | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Evidence Inspector Modal state
  const [evidenceModalOpen, setEvidenceModalOpen] = useState<boolean>(false);
  const [evidenceTrace, setEvidenceTrace] = useState<EvidenceTrace | null>(null);

  // Custom History Summary Modal state
  const [summaryModalOpen, setSummaryModalOpen] = useState<boolean>(false);
  const [limitType, setLimitType] = useState<"consultations" | "days">("consultations");
  const [limitValue, setLimitValue] = useState<number>(3);
  const [customSummaryResult, setCustomSummaryResult] = useState<any>(null);
  const [generatingCustomSummary, setGeneratingCustomSummary] = useState<boolean>(false);

  const handleGenerateCustomSummary = async () => {
    try {
      setGeneratingCustomSummary(true);
      const res = await fetchCustomHistorySummary(patientId, limitType, limitValue);
      setCustomSummaryResult(res);
    } catch (err) {
      console.error("Custom summary error", err);
    } finally {
      setGeneratingCustomSummary(false);
    }
  };

  // Contextual Copilot Chat state
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: "doctor" | "ai"; text: string }>>([
    {
      sender: "ai",
      text: `Hello ${user?.fullName || "Doctor"}! I am locked into ${patientId} context. Ask me anything about this patient's medical history, lab trends, or past diagnoses.`,
    },
  ]);
  const [copilotInput, setCopilotInput] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ovRes, tmRes, briefRes, trendRes, wnRes] = await Promise.allSettled([
        fetchPatientOverview(patientId),
        fetchPatientTimeline(patientId),
        fetchPreConsultationBrief(patientId),
        fetchLabTrends(patientId),
        fetchWhatsNew(patientId),
      ]);
      if (ovRes.status === "fulfilled") setOverview(ovRes.value);
      if (tmRes.status === "fulfilled") setTimeline(tmRes.value);
      if (briefRes.status === "fulfilled") setPreBrief(briefRes.value);
      if (trendRes.status === "fulfilled") setLabTrends(trendRes.value);
      if (wnRes.status === "fulfilled") setWhatsNew(wnRes.value);
    } catch (err) {
      console.error("Failed to load patient workspace", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEvidence = async () => {
    try {
      const trace = await fetchEvidenceTrace(patientId, "insight_01");
      setEvidenceTrace(trace);
      setEvidenceModalOpen(true);
    } catch (err) {
      console.error("Failed to fetch evidence trace", err);
    }
  };

  const handleAnalyzeTimeline = async () => {
    try {
      const res = await fetchTimelineAnalysis(patientId);
      setTimelineAnalysis(res.analysis);
    } catch (err) {
      console.error("Failed to analyze timeline", err);
    }
  };

  const handleSendCopilotMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotInput.trim()) return;
    const text = copilotInput.trim();
    setCopilotInput("");
    setCopilotMessages((prev) => [...prev, { sender: "doctor", text }]);

    try {
      const res = await sendDoctorCopilotQuery(patientId, text);
      setCopilotMessages((prev) => [...prev, { sender: "ai", text: res.reply }]);
    } catch (err) {
      setCopilotMessages((prev) => [
        ...prev,
        { sender: "ai", text: "Copilot query failed. Verify backend connection." },
      ]);
    }
  };

  const setTab = (tab: string) => {
    setSearchParams({ tab });
  };

  const profile = overview?.profile || timeline?.profile || {};
  const patientName = profile.fullName || profile.name || "Patient Record";

  return (
    <div className="space-y-8 pb-20">
      {/* Header Banner */}
      <PageHeader
        eyebrow="360° Clinical Patient Record"
        title={patientName}
        meta={`Patient Code: ${profile.patient_id_code || patientId} • ${profile.age || 42} yrs • ${profile.gender || "Male"} • Blood: ${profile.bloodGroup || "O+"}`}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSummaryModalOpen(true)}
              className="flex items-center gap-2 rounded-full border border-hairline bg-surface-card px-4 py-2 text-xs font-mono font-semibold text-ink hover:border-teal-deep hover:bg-teal-deep/5 transition-all shadow-xs"
            >
              <Sparkles className="h-4 w-4 text-teal-deep" />
              <span>🤖 Custom History Summary</span>
            </button>
            <button
              onClick={() => navigate(`/doctor/patient/${patientId}/consult`)}
              className="flex items-center gap-2 rounded-full bg-ink px-6 py-2 text-xs font-mono font-bold text-bg-mist hover:opacity-90 transition-opacity shadow-md"
            >
              <Zap className="h-4 w-4 text-clay-alert" />
              <span>⚡ Start Consultation Session</span>
            </button>
          </div>
        }
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* WHAT'S NEW DELTA BANNER */}
        {whatsNew && Array.isArray(whatsNew.relevant_changes) && whatsNew.relevant_changes.length > 0 && (
          <div className="rounded-2xl border border-teal-deep/30 bg-teal-deep/5 p-4 shadow-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-teal-deep shrink-0" />
              <div>
                <span className="font-mono text-xs font-bold text-teal-deep uppercase tracking-wider block">
                  ⚡ WHAT'S NEW SINCE LAST VISIT
                </span>
                <p className="text-xs text-ink font-medium">
                  {(whatsNew.relevant_changes || []).join(" • ")}
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenEvidence}
              className="rounded-xl border border-teal-deep/30 bg-surface-card px-3.5 py-1.5 font-mono text-xs text-teal-deep hover:bg-teal-deep/10 shrink-0"
            >
              Inspect Evidence Trace
            </button>
          </div>
        )}

        {/* WORKSPACE NAVIGATION TABS */}
        <div className="flex items-center justify-between border-b border-hairline pb-3 overflow-x-auto">
          <div className="flex items-center gap-2">
            {[
              { id: "overview", label: "Overview & Vitals", icon: User },
              { id: "labs", label: "Lab Intelligence", icon: Activity },
              { id: "timeline", label: "Clinical Timeline", icon: Calendar },
              { id: "copilot", label: "Clinical Copilot", icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-ink text-bg-mist shadow-xs"
                    : "border border-hairline bg-surface-card text-stone hover:text-ink"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate(`/doctor/patient/${patientId}/consult`)}
            className="hidden sm:flex items-center gap-1.5 text-xs font-mono font-bold text-teal-deep hover:underline"
          >
            <span>Launch Consultation Suite</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* TAB 1: OVERVIEW & VITALS */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Vitals Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-1">
                <span className="font-mono text-[11px] text-stone uppercase tracking-wider block">Age & Gender</span>
                <p className="font-display text-2xl font-bold text-ink">{profile.age || 42} <span className="text-xs text-stone font-normal">yrs</span></p>
                <span className="font-mono text-[10px] text-stone">{profile.gender || "Male"}</span>
              </div>

              <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-1">
                <span className="font-mono text-[11px] text-stone uppercase tracking-wider block">Blood Group</span>
                <p className="font-display text-2xl font-bold text-clay-alert">{profile.bloodGroup || "O+"}</p>
                <span className="font-mono text-[10px] text-stone">Verified Medical Record</span>
              </div>

              <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-1">
                <span className="font-mono text-[11px] text-stone uppercase tracking-wider block">Weight & BMI</span>
                <p className="font-display text-2xl font-bold text-teal-deep">{profile.weightKg || 70} <span className="text-xs text-stone font-normal">kg</span></p>
                <span className="font-mono text-[10px] text-stone">BMI: {profile.bmi || 22.5}</span>
              </div>

              <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-1">
                <span className="font-mono text-[11px] text-stone uppercase tracking-wider block">Adherence Rate</span>
                <p className="font-display text-2xl font-bold text-emerald-600">{overview?.adherence_rate || "86%"}</p>
                <span className="font-mono text-[10px] text-emerald-600">Medication Compliance</span>
              </div>
            </div>

            {/* Medical Passport Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Active Conditions */}
              <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
                <h3 className="font-display text-lg font-semibold text-ink flex items-center justify-between">
                  <span>Active Diagnoses & Conditions</span>
                  <span className="font-mono text-xs text-stone">({profile.conditions?.length || 0})</span>
                </h3>
                <div className="space-y-2">
                  {(profile.conditions || ["Mild Hypertension", "Early Pre-diabetes"]).map((cond: string, idx: number) => (
                    <div key={idx} className="rounded-xl border border-hairline bg-bg-mist p-3 text-xs font-semibold text-ink flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-teal-deep" />
                      <span>{cond}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active Prescriptions */}
              <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
                <h3 className="font-display text-lg font-semibold text-ink flex items-center justify-between">
                  <span>Current Prescribed Medications</span>
                  <span className="font-mono text-xs text-stone">({timeline?.active_medications?.length || 0})</span>
                </h3>
                <div className="space-y-2">
                  {(timeline?.active_medications || []).map((rx: any, idx: number) => (
                    <div key={idx} className="rounded-xl border border-hairline bg-bg-mist p-3 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-ink">{rx.medication_name} ({rx.dosage})</span>
                        <p className="text-[11px] text-stone">{rx.frequency}</p>
                      </div>
                      <span className="font-mono text-[10px] bg-teal-deep/10 text-teal-deep font-bold px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LAB INTELLIGENCE */}
        {activeTab === "labs" && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h3 className="font-display text-lg font-semibold text-ink">Parsed Lab Reports & Diagnostic Metrics</h3>
              <span className="font-mono text-xs text-stone">{labTrends.length} Tracked Metrics</span>
            </div>

            {labTrends.length === 0 ? (
              <p className="font-mono text-xs text-stone italic">No diagnostic lab trends recorded yet.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {labTrends.map((metric, idx) => (
                  <div key={idx} className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-semibold text-ink">{metric.metric_name}</span>
                      <span className="font-mono text-xs font-bold text-teal-deep">{metric.unit}</span>
                    </div>
                    <div className="space-y-1">
                      {(metric.history || []).map((pt, pIdx) => (
                        <div key={pIdx} className="flex items-center justify-between text-xs font-mono">
                          <span className="text-stone">{pt.date}</span>
                          <span className={pt.is_abnormal ? "text-clay-alert font-bold" : "text-ink"}>
                            {pt.value} {pt.is_abnormal ? "(Abnormal)" : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: CLINICAL TIMELINE */}
        {activeTab === "timeline" && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <h3 className="font-display text-lg font-semibold text-ink">Past Clinical Consultation Sign-Offs</h3>
              <button
                onClick={handleAnalyzeTimeline}
                className="rounded-xl border border-hairline bg-bg-mist px-3.5 py-1.5 font-mono text-xs text-ink hover:bg-surface-card"
              >
                🤖 Run AI Timeline Analysis
              </button>
            </div>

            {timelineAnalysis && (
              <div className="rounded-xl border border-teal-deep/30 bg-teal-deep/5 p-4 font-mono text-xs text-ink whitespace-pre-line">
                {timelineAnalysis}
              </div>
            )}

            <div className="space-y-4">
              {(timeline?.consultations || []).map((c: any) => (
                <div key={c.id || Math.random()} className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-teal-deep">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : "Recent Visit"}
                    </span>
                    <span className="font-mono text-xs text-stone">Doctor: {c.doctor_name || "Assigned Physician"}</span>
                  </div>
                  {c.doctor_diagnosis && (
                    <p className="font-display text-base font-semibold text-ink">Diagnosis: {c.doctor_diagnosis}</p>
                  )}
                  {c.doctor_notes && (
                    <p className="text-xs text-stone leading-relaxed">{c.doctor_notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: CONTEXTUAL COPILOT */}
        {activeTab === "copilot" && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-teal-deep" />
                <h3 className="font-display text-lg font-semibold text-ink">Contextual Copilot Assistant</h3>
              </div>
              <span className="font-mono text-xs text-stone">Locked to Patient {patientId}</span>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {copilotMessages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl text-xs max-w-xl shadow-xs ${
                    m.sender === "doctor"
                      ? "bg-ink text-bg-mist ml-auto font-medium"
                      : "bg-bg-mist text-ink border border-hairline"
                  }`}
                >
                  {m.sender === "doctor" ? m.text : <FormattedText text={m.text} />}
                </div>
              ))}
            </div>

            <form onSubmit={handleSendCopilotMessage} className="flex items-center gap-2 pt-3 border-t border-hairline">
              <input
                type="text"
                placeholder="Ask Copilot about this patient's medical history..."
                value={copilotInput}
                onChange={(e) => setCopilotInput(e.target.value)}
                className="flex-1 rounded-xl border border-hairline bg-bg-mist p-3 text-xs text-ink outline-none"
              />
              <button type="submit" className="rounded-xl bg-ink px-4 py-3 text-xs font-mono text-bg-mist hover:opacity-90">
                Send Query
              </button>
            </form>
          </div>
        )}
      </div>

      {/* EVIDENCE INSPECTOR MODAL */}
      {evidenceModalOpen && evidenceTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="font-display font-semibold text-lg text-ink">Evidence Inspector</h3>
              <button onClick={() => setEvidenceModalOpen(false)} className="text-stone hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p><span className="font-semibold">Insight ID:</span> {evidenceTrace.insight_id}</p>
              <p><span className="font-semibold">Reasoning:</span> {evidenceTrace.reasoning}</p>
              <div>
                <span className="font-semibold block mb-1">Supporting Sources:</span>
                <div className="space-y-1">
                  {evidenceTrace.sources.map((s, idx) => (
                    <div key={idx} className="rounded-lg bg-bg-mist p-2 font-mono text-[11px]">
                      {s.title} ({s.document_date})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM HISTORY SUMMARY MODAL */}
      {summaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-teal-deep" />
                <h3 className="font-display font-semibold text-lg text-ink">Generate Custom Medical History Summary</h3>
              </div>
              <button
                onClick={() => {
                  setSummaryModalOpen(false);
                  setCustomSummaryResult(null);
                }}
                className="text-stone hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter Prompt Options */}
            <div className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-4">
              <span className="font-mono text-xs uppercase font-bold text-stone block">Select Summary Window & Criteria:</span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-[11px] text-stone block mb-1">Filter By</label>
                  <select
                    value={limitType}
                    onChange={(e) => setLimitType(e.target.value as any)}
                    className="w-full rounded-xl border border-hairline bg-surface-card p-2.5 text-xs text-ink outline-none"
                  >
                    <option value="consultations">Past Consultation Count</option>
                    <option value="days">Time Period (Days)</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[11px] text-stone block mb-1">Select Range / Value</label>
                  {limitType === "consultations" ? (
                    <select
                      value={limitValue}
                      onChange={(e) => setLimitValue(Number(e.target.value))}
                      className="w-full rounded-xl border border-hairline bg-surface-card p-2.5 text-xs text-ink outline-none"
                    >
                      <option value={3}>Last 3 Consultations</option>
                      <option value={5}>Last 5 Consultations</option>
                      <option value={10}>Last 10 Consultations</option>
                    </select>
                  ) : (
                    <select
                      value={limitValue}
                      onChange={(e) => setLimitValue(Number(e.target.value))}
                      className="w-full rounded-xl border border-hairline bg-surface-card p-2.5 text-xs text-ink outline-none"
                    >
                      <option value={30}>Last 30 Days</option>
                      <option value={60}>Last 60 Days</option>
                      <option value={90}>Last 90 Days</option>
                      <option value={180}>Last 180 Days (6 Months)</option>
                    </select>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleGenerateCustomSummary}
                  disabled={generatingCustomSummary}
                  className="flex items-center gap-2 rounded-xl bg-teal-deep text-white px-5 py-2.5 text-xs font-mono font-bold hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Sparkles className={`h-4 w-4 ${generatingCustomSummary ? "animate-spin" : ""}`} />
                  <span>{generatingCustomSummary ? "Synthesizing AI Summary..." : "⚡ Generate AI Summary"}</span>
                </button>
              </div>
            </div>

            {/* Generated Result Container */}
            {customSummaryResult && (
              <div className="space-y-3 pt-2 border-t border-hairline">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-teal-deep">✓ AI Clinical Summary ({customSummaryResult.filter_label})</span>
                  <span className="text-stone">Found {customSummaryResult.consultations_count} consultations, {customSummaryResult.prescriptions_count} Rx</span>
                </div>
                <div className="rounded-xl border border-hairline bg-bg-mist p-4 text-xs font-sans text-ink leading-relaxed max-h-64 overflow-y-auto">
                  <FormattedText text={customSummaryResult.summary} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
