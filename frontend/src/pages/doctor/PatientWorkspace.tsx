import React, { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchPatientOverview,
  fetchPatientTimeline,
  fetchTimelineAnalysis,
  fetchPreConsultationBrief,
  fetchLabTrends,
  fetchWhatsNew,
  fetchEvidenceTrace,
  parseVoiceNotes,
  sendDoctorCopilotQuery,
  createConsultation,
  triggerAIDecisionSupport,
  finalizeConsultation,
} from "@/services/clinicalService";
import type {
  ConsultationSession,
  EvidenceTrace,
  LabMetricTrend,
  PreConsultationBrief,
  PrescriptionItem,
  WhatsNewChanges,
} from "@/types";
import {
  Activity,
  Calendar,
  FileStack,
  MessageSquare,
  Mic,
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

  // Voice Dictation state
  const [isDictating, setIsDictating] = useState<boolean>(false);
  const [voiceSpeechRaw, setVoiceSpeechRaw] = useState<string>("");

  // Consultation state
  const [consultStep, setConsultStep] = useState<number>(1);
  const [chiefComplaint, setChiefComplaint] = useState<string>("Fever, severe headache, dry cough");
  const [symptomsInput, setSymptomsInput] = useState<string>("Fever, Severe Headache, Dry Cough");
  const [durationInput, setDurationInput] = useState<string>("3 days");
  const [diagnosisInput, setDiagnosisInput] = useState<string>("Acute Viral Upper Respiratory Infection");
  const [doctorNotesInput, setDoctorNotesInput] = useState<string>("Patient presents with 3-day history of fever and dry cough. Lungs clear to auscultation.");
  const [doctorConfirmed, setDoctorConfirmed] = useState<boolean>(false);
  const [currentSession, setCurrentSession] = useState<ConsultationSession | null>(null);
  const [rxList, setRxList] = useState<PrescriptionItem[]>([
    { medication_name: "Paracetamol", dosage: "500 mg", frequency: "Twice daily after meals", duration_days: 5 },
    { medication_name: "Amoxicillin", dosage: "250 mg", frequency: "Three times daily", duration_days: 7 },
  ]);

  // Contextual Copilot Chat state (auto-locked into current patient context)
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: "doctor" | "ai"; text: string }>>([
    { sender: "ai", text: `Hello ${user?.fullName || "Doctor"}! I am locked into ${patientId} context. Ask me anything about this patient without needing @mentions.` },
  ]);
  const [copilotInput, setCopilotInput] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ovData, tmData, briefData, trendData, wnData] = await Promise.all([
        fetchPatientOverview(patientId),
        fetchPatientTimeline(patientId),
        fetchPreConsultationBrief(patientId),
        fetchLabTrends(patientId),
        fetchWhatsNew(patientId),
      ]);
      setOverview(ovData);
      setTimeline(tmData);
      setPreBrief(briefData);
      setLabTrends(trendData);
      setWhatsNew(wnData);
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

  const handleDictate = () => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Speech recognition is not supported in this browser. Please type notes directly.");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;

    if (!isDictating) {
      setIsDictating(true);
      recognition.start();
      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setVoiceSpeechRaw(transcript);
        setIsDictating(false);

        // Run AI Voice Parser to structure into fields
        try {
          const structured = await parseVoiceNotes(transcript);
          setChiefComplaint(structured.chief_complaint);
          setDoctorNotesInput(structured.doctor_notes);
          setDurationInput(structured.duration);
        } catch (err) {
          console.error("Failed structured voice parse", err);
        }
      };
      recognition.onerror = () => setIsDictating(false);
      recognition.onend = () => setIsDictating(false);
    } else {
      setIsDictating(false);
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

  const handleStartConsultation = async () => {
    try {
      const symptoms = symptomsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const session = await createConsultation({
        patient_id: patientId,
        symptoms,
        doctor_notes: doctorNotesInput,
      });
      const aiSession = await triggerAIDecisionSupport(session.id);
      setCurrentSession(aiSession);
      setConsultStep(2);
    } catch (err) {
      console.error("Failed to start consultation", err);
    }
  };

  const handleFinalizeConsultation = async () => {
    if (!currentSession) return;
    if (!doctorConfirmed) {
      alert("Please confirm you have reviewed the clinical decision support outputs before signing off.");
      return;
    }
    try {
      await finalizeConsultation(currentSession.id, {
        doctor_diagnosis: diagnosisInput,
        prescriptions: rxList,
        doctor_notes: doctorNotesInput,
        diet_recommendations: ["Increase fluid intake", "Low sodium diet"],
        doctor_confirmation: true,
      });
      alert("Consultation finalized and published to Patient Portal!");
      setConsultStep(1);
      loadData();
    } catch (err) {
      console.error("Failed to finalize consultation", err);
    }
  };

  const handleCopilotSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!copilotInput.trim()) return;
    const msg = copilotInput.trim();
    setCopilotInput("");
    setCopilotMessages((prev) => [...prev, { sender: "doctor", text: msg }]);

    try {
      const res = await sendDoctorCopilotQuery(patientId, msg);
      setCopilotMessages((prev) => [...prev, { sender: "ai", text: res.reply }]);
    } catch (err) {
      console.error("Failed copilot query", err);
    }
  };

  const setTab = (t: string) => {
    setSearchParams({ tab: t });
  };

  const patientName = overview?.profile?.fullName || patientId;
  const age = overview?.profile?.age ?? null;
  const gender = overview?.profile?.gender || "—";
  const isAttention = (whatsNew?.attention_items_count ?? 0) > 0;

  return (
    <div className="space-y-6 pb-16">
      {/* Evidence Inspector Modal */}
      {evidenceModalOpen && evidenceTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-teal-deep" />
                <h3 className="font-display font-semibold text-lg text-ink">Explain Why? Evidence Trace</h3>
              </div>
              <button onClick={() => setEvidenceModalOpen(false)} className="text-stone hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="rounded-xl border border-hairline bg-bg-mist p-3 space-y-1">
                <span className="font-bold text-teal-deep block">Evidence Sources Used:</span>
                <ul className="list-disc list-inside text-ink space-y-1">
                  {evidenceTrace.evidence_sources.map((src, i) => <li key={i}>{src}</li>)}
                </ul>
              </div>

              <div className="rounded-xl border border-hairline bg-bg-mist p-3 space-y-1">
                <span className="font-bold text-clay-alert block">Relevant Clinical Changes:</span>
                <ul className="list-disc list-inside text-stone space-y-1">
                  {evidenceTrace.relevant_changes.map((ch, i) => <li key={i}>{ch}</li>)}
                </ul>
              </div>
            </div>

            <button
              onClick={() => setEvidenceModalOpen(false)}
              className="w-full rounded-full bg-ink py-2.5 text-xs font-mono text-bg-mist"
            >
              Close Evidence Trace
            </button>
          </div>
        </div>
      )}

      {/* Patient Workspace Top Banner */}
      <div className="border-b border-hairline bg-surface-card px-5 py-6 sm:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-ink text-bg-mist flex items-center justify-center font-display font-bold text-xl">
              {patientName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl tracking-tight text-ink font-semibold">{patientName}</h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-teal-deep/10 text-teal-deep font-semibold">
                  {age ?? "—"} • {gender} • {overview?.profile?.bloodGroup || "—"} • ID: {patientId}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full ${
                    isAttention
                      ? "bg-clay-alert/10 text-clay-alert border border-clay-alert/20"
                      : "bg-teal-deep/10 text-teal-deep border border-teal-deep/20"
                  }`}
                >
                  {isAttention ? "🟠 Attention Required" : "🟢 Stable"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab("consultations")}
              className="rounded-full bg-ink px-4 py-2 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity"
            >
              + Start Consultation
            </button>
            <button
              onClick={() => setTab("copilot")}
              className="rounded-full border border-hairline bg-bg-mist px-4 py-2 text-xs font-mono text-ink hover:bg-surface-card transition-colors flex items-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-teal-deep" />
              <span>Ask AI</span>
            </button>
          </div>
        </div>

        {/* Intelligent Patient Snapshot Card */}
        <div className="rounded-2xl border border-hairline bg-bg-mist p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 font-mono text-xs shadow-xs">
          <div>
            <span className="text-stone text-[10px] uppercase block">Diagnosis</span>
            <span className="font-semibold text-ink">{overview?.latest_diagnosis || "Not yet diagnosed"}</span>
          </div>
          <div>
            <span className="text-stone text-[10px] uppercase block">Adherence</span>
            <span className="font-semibold text-teal-deep font-bold">{overview?.adherence_rate || "No data"}</span>
          </div>
          <div>
            <span className="text-stone text-[10px] uppercase block">Last Visit</span>
            <span className="font-semibold text-ink">{whatsNew?.last_visit_date || "No prior visit"}</span>
          </div>
          <div>
            <span className="text-stone text-[10px] uppercase block">Next Visit</span>
            <span className="font-semibold text-ink">
              {overview?.next_appointment_date ? new Date(overview.next_appointment_date).toLocaleDateString() : "Not scheduled"}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-xl bg-clay-alert/10 border border-clay-alert/20 p-2 text-center text-clay-alert font-bold">
            ⚠ {whatsNew?.attention_items_count ?? 0} items need attention
          </div>
        </div>

        {/* 10 Workspace Tabs Bar */}
        <nav className="flex gap-1 overflow-x-auto border-t border-hairline pt-3 text-xs font-mono">
          {[
            { id: "overview", label: "Overview" },
            { id: "timeline", label: "Timeline" },
            { id: "consultations", label: "Consultations" },
            { id: "vitals", label: "Vitals" },
            { id: "labs", label: "Labs Intelligence" },
            { id: "medications", label: "Medications" },
            { id: "diet", label: "Diet" },
            { id: "appointments", label: "Appointments" },
            { id: "documents", label: "Documents" },
            { id: "copilot", label: "AI Copilot" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`px-3 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-ink text-bg-mist font-semibold shadow-xs"
                  : "text-stone hover:text-ink hover:bg-bg-mist/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Main Tab Content */}
      <div className="px-5 sm:px-8 space-y-6">
        {/* FIRE FEATURE 1: "WHAT'S NEW / WHAT'S CHANGED SINCE LAST VISIT" */}
        {whatsNew && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-teal-deep" />
                <h2 className="font-display text-lg tracking-tight text-ink font-semibold">
                  What's Changed Since Last Visit ({whatsNew.last_visit_date} → {whatsNew.current_date})
                </h2>
              </div>
              <button
                onClick={() => setTab("timeline")}
                className="font-mono text-xs text-teal-deep hover:underline font-semibold"
              >
                [Review Changes]
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
              {/* Metrics Changes Delta */}
              <div className="space-y-2">
                <span className="text-stone uppercase text-[10px] font-bold block">Biometric & Compliance Deltas:</span>
                <div className="space-y-2">
                  {whatsNew.metrics_changes.map((mc, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        mc.is_abnormal ? "bg-clay-alert/5 border-clay-alert/30 text-clay-alert font-bold" : "bg-bg-mist border-hairline text-ink"
                      }`}
                    >
                      <span>{mc.metric}</span>
                      <span>{mc.previous} → <strong className="underline">{mc.current}</strong></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Events Since Last Visit */}
              <div className="space-y-2">
                <span className="text-stone uppercase text-[10px] font-bold block">Events & Logs Since Last Visit:</span>
                <div className="space-y-2">
                  {whatsNew.events_since_last_visit.map((ev, idx) => (
                    <div key={idx} className="p-3 rounded-xl border border-hairline bg-bg-mist text-ink">
                      {ev}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center font-mono text-sm text-stone">Loading patient context...</div>
        ) : (
          <>
            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
                    <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
                      Clinical Summary
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono text-xs">
                      <div className="rounded-xl border border-hairline bg-bg-mist p-3">
                        <span className="text-stone block text-[10px] uppercase">Chronic Conditions</span>
                        <span className="font-semibold text-ink">{overview?.profile?.conditions?.join(", ") || "None recorded"}</span>
                      </div>
                      <div className="rounded-xl border border-hairline bg-bg-mist p-3">
                        <span className="text-stone block text-[10px] uppercase">Allergies</span>
                        <span className="font-semibold text-clay-alert">
                          {overview?.profile?.allergies?.join(", ") || "No known allergies recorded"}
                        </span>
                      </div>
                      <div className="rounded-xl border border-hairline bg-bg-mist p-3">
                        <span className="text-stone block text-[10px] uppercase">Active Prescriptions</span>
                        <span className="font-semibold text-ink">
                          {timeline?.active_medications?.length
                            ? timeline.active_medications.map((m: any) => `${m.medication_name} ${m.dosage}`).join(", ")
                            : "No active prescriptions"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
                    <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
                      Latest Vitals & Lab Snapshot
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
                      <div className="rounded-xl border border-hairline bg-bg-mist p-3 text-center">
                        <span className="text-stone text-[10px] block">Blood Pressure</span>
                        <span className="font-display font-bold text-base text-ink">
                          {overview?.latest_vitals ? `${overview.latest_vitals.systolic_bp}/${overview.latest_vitals.diastolic_bp}` : "—"}
                        </span>
                      </div>
                      <div className="rounded-xl border border-hairline bg-bg-mist p-3 text-center">
                        <span className="text-stone text-[10px] block">Heart Rate</span>
                        <span className="font-display font-bold text-base text-ink">
                          {overview?.latest_vitals?.heart_rate != null ? `${overview.latest_vitals.heart_rate} bpm` : "—"}
                        </span>
                      </div>
                      <div className="rounded-xl border border-hairline bg-bg-mist p-3 text-center">
                        <span className="text-stone text-[10px] block">Temperature</span>
                        <span className="font-display font-bold text-base text-ink">
                          {overview?.latest_vitals?.temperature_c != null ? `${overview.latest_vitals.temperature_c} °C` : "—"}
                        </span>
                      </div>
                      <div className="rounded-xl border border-hairline bg-bg-mist p-3 text-center">
                        <span className="text-stone text-[10px] block">Spo2</span>
                        <span className="font-display font-bold text-base text-teal-deep">
                          {overview?.latest_vitals?.spo2_pct != null ? `${overview.latest_vitals.spo2_pct}%` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pre-Consultation Brief Card */}
                <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-hairline pb-3">
                    <Sparkles className="h-4 w-4 text-teal-deep" />
                    <h2 className="font-display text-lg tracking-tight text-ink font-semibold">
                      Pre-Consultation Brief
                    </h2>
                  </div>
                  <div className="space-y-3 font-mono text-xs">
                    <p className="text-stone">Last Visit: <span className="text-ink font-semibold">{preBrief?.last_visit_date}</span></p>
                    <div className="rounded-xl border border-teal-deep/30 bg-teal-deep/5 p-3 space-y-1">
                      <span className="font-bold text-teal-deep block">Main Concerns:</span>
                      <ul className="list-disc list-inside text-ink space-y-1">
                        {preBrief?.main_concerns.map((c, idx) => <li key={idx}>{c}</li>)}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-hairline bg-bg-mist p-3 space-y-1">
                      <span className="font-bold text-ink block">Suggested Discussion:</span>
                      <ul className="list-disc list-inside text-stone space-y-1">
                        {preBrief?.suggested_discussion_topics.map((t, idx) => <li key={idx}>{t}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TIMELINE */}
            {activeTab === "timeline" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-2xl border border-hairline bg-surface-card p-4">
                  <span className="font-mono text-xs text-stone">Chronological Clinical Timeline</span>
                  <button
                    onClick={handleAnalyzeTimeline}
                    className="rounded-full bg-ink px-4 py-2 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity flex items-center gap-1.5"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-teal-deep" />
                    <span>Analyze Timeline with AI</span>
                  </button>
                </div>

                {timelineAnalysis && (
                  <div className="rounded-2xl border border-teal-deep/30 bg-teal-deep/5 p-6 font-mono text-xs space-y-2">
                    <span className="font-bold text-teal-deep block">🤖 AI Timeline Insights:</span>
                    <pre className="whitespace-pre-wrap font-sans text-ink">{timelineAnalysis}</pre>
                  </div>
                )}

                <div className="space-y-4">
                  {(timeline?.consultations || []).map((c: any) => (
                    <div key={c.id} className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-2">
                      <div className="flex items-center justify-between font-mono text-xs">
                        <span className="font-semibold text-teal-deep">🩺 Consultation Session ({c.status})</span>
                        <span className="text-stone">{new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-display text-base text-ink font-semibold">{c.doctor_diagnosis || "Intake Consultation"}</h3>
                      <p className="text-xs text-stone">{c.doctor_notes}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: CONSULTATION WORKSPACE */}
            {activeTab === "consultations" && (
              <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-hairline pb-4">
                  <div>
                    <h2 className="font-display text-xl tracking-tight text-ink font-semibold">
                      Redesigned Consultation Workspace
                    </h2>
                    <p className="text-xs text-stone">Patient: {patientName} ({patientId})</p>
                  </div>

                  <button
                    onClick={handleDictate}
                    className={`rounded-full px-4 py-2 text-xs font-mono border flex items-center gap-2 ${
                      isDictating
                        ? "bg-clay-alert text-bg-mist border-clay-alert animate-pulse"
                        : "bg-bg-mist text-ink border-hairline hover:bg-surface-card"
                    }`}
                  >
                    <Mic className="h-4 w-4" />
                    <span>{isDictating ? "Listening... (Speak naturally)" : "🎙️ Dictate Structured Notes"}</span>
                  </button>
                </div>

                {consultStep === 1 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Chief Complaint:</label>
                        <input
                          type="text"
                          value={chiefComplaint}
                          onChange={(e) => setChiefComplaint(e.target.value)}
                          className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Duration:</label>
                        <input
                          type="text"
                          value={durationInput}
                          onChange={(e) => setDurationInput(e.target.value)}
                          className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                        Chief Symptoms (comma-separated):
                      </label>
                      <input
                        type="text"
                        value={symptomsInput}
                        onChange={(e) => setSymptomsInput(e.target.value)}
                        className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                      />
                    </div>

                    <div>
                      <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                        Doctor Intake Notes:
                      </label>
                      <textarea
                        rows={3}
                        value={doctorNotesInput}
                        onChange={(e) => setDoctorNotesInput(e.target.value)}
                        className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                      />
                    </div>

                    <button
                      onClick={handleStartConsultation}
                      className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-bg-mist hover:opacity-90 transition-opacity"
                    >
                      Generate AI Decision Support →
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* AI Advisory Disclaimer Banner */}
                    <div className="rounded-xl border border-indigo-thread/30 bg-indigo-thread/5 p-4 flex items-center justify-between font-mono text-xs">
                      <div className="flex items-center gap-2 text-indigo-thread font-semibold">
                        <ShieldCheck className="h-4 w-4" />
                        <span>🤖 AI Decision Support — Advisory outputs only. Doctor review and clinical judgment required.</span>
                      </div>
                      <button
                        onClick={handleOpenEvidence}
                        className="underline text-teal-deep font-bold hover:text-ink"
                      >
                        Explain Why?
                      </button>
                    </div>

                    <div>
                      <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Doctor Final Diagnosis:</label>
                      <input
                        type="text"
                        value={diagnosisInput}
                        onChange={(e) => setDiagnosisInput(e.target.value)}
                        className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink font-semibold focus:outline-none focus:ring-2 focus:ring-teal-deep"
                      />
                    </div>

                    <div className="space-y-2">
                      <span className="font-mono text-xs uppercase tracking-wider text-stone block">Prescriptions:</span>
                      {rxList.map((rx, idx) => (
                        <div key={idx} className="flex gap-2 items-center font-mono text-xs">
                          <span className="font-semibold text-ink">{rx.medication_name} ({rx.dosage})</span>
                          <span className="text-stone">- {rx.frequency}</span>
                        </div>
                      ))}
                    </div>

                    {/* Doctor Sign-off Confirmation Checkbox */}
                    <div className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer font-mono text-xs text-ink font-semibold">
                        <input
                          type="checkbox"
                          checked={doctorConfirmed}
                          onChange={(e) => setDoctorConfirmed(e.target.checked)}
                          className="h-4 w-4 rounded border-hairline text-teal-deep focus:ring-teal-deep"
                        />
                        <span>I have reviewed the information and confirm this clinical treatment plan.</span>
                      </label>
                    </div>

                    <button
                      onClick={handleFinalizeConsultation}
                      disabled={!doctorConfirmed}
                      className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-bg-mist hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      ✓ Doctor Sign Off & Publish Care Plan
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: LAB INTELLIGENCE */}
            {activeTab === "labs" && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
                  <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
                    Lab Intelligence & Metric Trends
                  </h2>
                  <div className="space-y-4">
                    {labTrends.map((trend, idx) => (
                      <div key={idx} className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-2">
                        <div className="flex items-center justify-between font-mono text-xs">
                          <span className="font-display font-semibold text-ink text-sm">{trend.metric_name} ({trend.unit})</span>
                          <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase ${trend.trend_direction === "up" ? "bg-clay-alert/10 text-clay-alert" : "bg-teal-deep/10 text-teal-deep"}`}>
                            Trend: {trend.trend_direction}
                          </span>
                        </div>
                        <div className="flex gap-3 pt-2 font-mono text-xs">
                          {trend.history.map((pt, i) => (
                            <div key={i} className={`p-2 rounded-lg border text-center ${pt.is_abnormal ? "bg-clay-alert/10 border-clay-alert/30 text-clay-alert" : "bg-surface-card border-hairline text-ink"}`}>
                              <span className="block text-[10px] text-stone">{pt.date}</span>
                              <span className="font-bold text-sm">{pt.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 10: CONTEXTUAL AI COPILOT */}
            {activeTab === "copilot" && (
              <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-hairline pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-teal-deep" />
                    <h2 className="font-display text-lg tracking-tight text-ink font-semibold">
                      Contextual AI Copilot (Locked to {patientName})
                    </h2>
                  </div>
                  <button
                    onClick={handleOpenEvidence}
                    className="font-mono text-xs text-teal-deep hover:underline font-bold"
                  >
                    Explain Why? Evidence Trace
                  </button>
                </div>

                {/* AI Actions Buttons */}
                <div className="flex flex-wrap gap-2 pt-1 font-mono text-xs">
                  <button onClick={() => setTab("timeline")} className="px-3 py-1.5 rounded-lg border border-hairline bg-bg-mist text-ink hover:bg-surface-card">
                    [Compare Previous Visits]
                  </button>
                  <button onClick={() => setTab("medications")} className="px-3 py-1.5 rounded-lg border border-hairline bg-bg-mist text-ink hover:bg-surface-card">
                    [Review Medication Adherence]
                  </button>
                  <button onClick={() => setTab("diet")} className="px-3 py-1.5 rounded-lg border border-hairline bg-bg-mist text-ink hover:bg-surface-card">
                    [Review Diet Logs]
                  </button>
                  <button onClick={() => setTab("labs")} className="px-3 py-1.5 rounded-lg border border-hairline bg-bg-mist text-ink hover:bg-surface-card">
                    [Open Lab Report]
                  </button>
                </div>

                <div className="min-h-[350px] max-h-[500px] overflow-y-auto space-y-3 p-2">
                  {copilotMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === "doctor" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl p-4 text-xs font-sans ${msg.sender === "doctor" ? "bg-ink text-bg-mist" : "bg-bg-mist border border-hairline text-ink"}`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCopilotSend} className="flex gap-2">
                  <input
                    type="text"
                    value={copilotInput}
                    onChange={(e) => setCopilotInput(e.target.value)}
                    placeholder={`Ask about ${patientName} (e.g. "Why is his glucose trending upward?", "Summarize last 3 visits")...`}
                    className="flex-1 rounded-xl border border-hairline bg-bg-mist px-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-ink px-6 py-3 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity"
                  >
                    Send Query
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
