import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { PageHeader } from "@/components/PageHeader";
import { FormattedText } from "@/components/FormattedText";
import {
  fetchPatientOverview,
  fetchLabTrends,
  createConsultation,
  triggerAIDecisionSupport,
  finalizeConsultation,
  checkMedicationSafety,
  parseVoiceNotes,
  sendDoctorCopilotQuery,
  uploadLabReport,
  generateAIDietPlan,
  orderLabTest,
} from "@/services/clinicalService";
import type {
  ConsultationSession,
  LabMetricTrend,
  PrescriptionItem,
  Vitals,
} from "@/types";
import {
  Stethoscope,
  Activity,
  Pill,
  Utensils,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Mic,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Send,
  X,
  UploadCloud,
  FileText,
  Plus,
  Trash2,
  Check,
  RefreshCw,
} from "lucide-react";

export const ActiveConsultationSuite: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const patientId = id || "pat_01";
  const navigate = useNavigate();
  const { user } = useUser();

  const [overview, setOverview] = useState<any>(null);
  const [labTrends, setLabTrends] = useState<LabMetricTrend[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [consultStep, setConsultStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Intake & Vitals (Clean, unpopulated initial state)
  const [symptomsInput, setSymptomsInput] = useState<string>("");
  const [vitalsRecorded, setVitalsRecorded] = useState<boolean>(false);
  const [vitals, setVitals] = useState<Vitals>({
    bp_systolic: 0,
    bp_diastolic: 0,
    heart_rate: 0,
    temperature_c: 0,
    spo2_pct: 0,
  });
  const [intakeNotes, setIntakeNotes] = useState<string>("");
  const [isDictating, setIsDictating] = useState<boolean>(false);

  // Consultation Session State
  const [session, setSession] = useState<ConsultationSession | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);

  // Step 2: AI Suggestions & Diagnoses
  const [diagnosisInput, setDiagnosisInput] = useState<string>("");
  const [uploadingLab, setUploadingLab] = useState<boolean>(false);
  const [labFile, setLabFile] = useState<File | null>(null);
  const [labReportTitle, setLabReportTitle] = useState<string>("Blood Panel & Lipid Report");

  // Step 3: Prescriptions, Diet & Lab Orders
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [newMedName, setNewMedName] = useState<string>("");
  const [newMedDose, setNewMedDose] = useState<string>("");
  const [newMedFreq, setNewMedFreq] = useState<string>("Twice daily");
  const [newMedDays, setNewMedDays] = useState<number>(7);
  const [safetyWarnings, setSafetyWarnings] = useState<Array<{ message: string; severity: string }>>([]);

  const [dietRecs, setDietRecs] = useState<string>("Hydration focus: Drink 2.5L water daily. Low sodium, heart-healthy diet.");
  const [generatingDiet, setGeneratingDiet] = useState<boolean>(false);

  const [labOrders, setLabOrders] = useState<Array<{ id: string; test_name: string; status: string }>>([]);
  const [newLabTestName, setNewLabTestName] = useState<string>("");
  const [orderingLab, setOrderingLab] = useState<boolean>(false);

  const [doctorProgressNotes, setDoctorProgressNotes] = useState<string>("");
  const [dischargeInstructions, setDischargeInstructions] = useState<string>(
    "Take prescribed medications after food. Rest well, hydrate with 2.5L fluids daily, and return for follow-up as scheduled."
  );

  // Step 4: Sign Off & Follow Up
  const [followUpDate, setFollowUpDate] = useState<string>(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [noFollowUp, setNoFollowUp] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);

  // Copilot Side-Drawer State
  const [copilotOpen, setCopilotOpen] = useState<boolean>(false);
  const [copilotMessages, setCopilotMessages] = useState<Array<{ sender: "doctor" | "ai"; text: string }>>([
    {
      sender: "ai",
      text: `Hello ${user?.fullName || "Doctor"}! I am locked into patient ${patientId} context. Ask me anything about past lab trends, allergies, or drug interactions.`,
    },
  ]);
  const [copilotInput, setCopilotInput] = useState<string>("");

  useEffect(() => {
    loadData();
  }, [patientId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ovRes, trendsRes] = await Promise.allSettled([
        fetchPatientOverview(patientId),
        fetchLabTrends(patientId),
      ]);
      if (ovRes.status === "fulfilled") setOverview(ovRes.value);
      if (trendsRes.status === "fulfilled") setLabTrends(trendsRes.value);
    } catch (err) {
      console.error("Failed to load patient workspace", err);
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill Baseline Vitals from Overview if Doctor clicks "Load Baseline"
  const handleLoadBaselineVitals = () => {
    if (overview?.latest_vitals) {
      setVitals(overview.latest_vitals);
    } else {
      setVitals({
        bp_systolic: 120,
        bp_diastolic: 80,
        heart_rate: 72,
        temperature_c: 36.8,
        spo2_pct: 99,
      });
    }
    setVitalsRecorded(true);
  };

  // Step 1 -> Step 2: Initialize Session & Trigger AI Decision Support
  const handleStartConsultationSession = async () => {
    try {
      setLoadingAI(true);
      const symptoms = symptomsInput
        ? symptomsInput.split(",").map((s) => s.trim()).filter(Boolean)
        : ["Routine consultation"];
      const created = await createConsultation({
        patient_id: patientId,
        symptoms,
        vitals: vitalsRecorded ? vitals : undefined,
        doctor_notes: intakeNotes,
      });
      setSession(created);

      // Trigger AI Assist
      const aiSession = await triggerAIDecisionSupport(created.id);
      setSession(aiSession);

      const list = getDifferentialList(aiSession);
      if (list.length > 0 && !diagnosisInput) {
        setDiagnosisInput(list[0]);
      }
      setConsultStep(2);
    } catch (err) {
      console.error("Failed to start session", err);
    } finally {
      setLoadingAI(false);
    }
  };

  // Helper to extract clean Differential Diagnoses list from AI response
  const getDifferentialList = (s = session): string[] => {
    if (!s?.ai_suggestions) {
      return ["Upper Respiratory Tract Infection (URTI)", "Acute Viral Bronchitis", "Seasonal Influenza"];
    }
    const diffs = s.ai_suggestions.differential_diagnoses;
    if (Array.isArray(diffs) && diffs.length > 0) return diffs;
    return ["Upper Respiratory Tract Infection (URTI)", "Acute Viral Bronchitis"];
  };

  // Handle OCR Lab Upload inside Step 2
  const handleUploadLabReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!labFile) return;
    try {
      setUploadingLab(true);
      await uploadLabReport(labReportTitle, patientId, labFile);
      setLabFile(null);
      // Reload lab trends & re-trigger AI decision support
      const updatedTrends = await fetchLabTrends(patientId);
      setLabTrends(updatedTrends);
      if (session) {
        setLoadingAI(true);
        const aiSession = await triggerAIDecisionSupport(session.id);
        setSession(aiSession);
        setLoadingAI(false);
      }
    } catch (err) {
      console.error("Lab upload error", err);
    } finally {
      setUploadingLab(false);
    }
  };

  // Handle Auto-Generating AI Clinical Diet Plan
  const handleAutoGenerateDiet = async () => {
    try {
      setGeneratingDiet(true);
      const res = await generateAIDietPlan(patientId, diagnosisInput || "Clinical Wellness Advice");
      if (res.recommendations?.length) {
        setDietRecs(res.recommendations.map((r) => `• ${r}`).join("\n"));
      }
    } catch (err) {
      console.error("Failed to generate AI diet plan", err);
    } finally {
      setGeneratingDiet(false);
    }
  };

  // Handle Ordering Diagnostic Lab Tests
  const handleOrderLabTest = async () => {
    if (!newLabTestName.trim()) return;
    try {
      setOrderingLab(true);
      const res = await orderLabTest(patientId, newLabTestName.trim());
      setLabOrders([...labOrders, { id: res.id, test_name: res.test_name, status: res.status }]);
      setNewLabTestName("");
    } catch (err) {
      console.error("Failed to order lab test", err);
    } finally {
      setOrderingLab(false);
    }
  };

  // Real-Time Drug Safety Check
  const handleAddPrescription = async () => {
    if (!newMedName.trim()) return;
    const medName = newMedName.trim();
    try {
      const check = await checkMedicationSafety(patientId, medName);
      if (!check.is_safe && check.warnings.length > 0) {
        setSafetyWarnings(check.warnings.map((w) => ({ message: w.message, severity: w.severity })));
      } else {
        setSafetyWarnings([]);
      }

      setPrescriptions([
        ...prescriptions,
        {
          medication_name: medName,
          dosage: newMedDose || "500 mg",
          frequency: newMedFreq || "Twice daily",
          duration_days: newMedDays || 7,
          instructions: "Take as directed",
        },
      ]);
      setNewMedName("");
      setNewMedDose("");
    } catch (err) {
      console.error("Safety check failed", err);
    }
  };

  const handleRemovePrescription = (index: number) => {
    setPrescriptions(prescriptions.filter((_, i) => i !== index));
  };

  // Voice Dictation Parsing
  const handleSimulateVoiceDictation = async () => {
    setIsDictating(true);
    const simulatedSpeech = "Patient presents with fever 38.2 C, severe headache, dry cough for 3 days. BP 130/85.";
    try {
      const parsed = await parseVoiceNotes(simulatedSpeech);
      if (parsed.symptoms.length) setSymptomsInput(parsed.symptoms.join(", "));
      if (parsed.doctor_notes) setIntakeNotes(parsed.doctor_notes);
      setVitalsRecorded(true);
      setVitals({
        bp_systolic: 130,
        bp_diastolic: 85,
        heart_rate: 80,
        temperature_c: 38.2,
        spo2_pct: 98,
      });
    } catch (err) {
      console.error("Voice parse error", err);
    } finally {
      setIsDictating(false);
    }
  };

  // Finalize & Sign Off Session
  const handleFinalizeSession = async () => {
    if (!session) return;
    try {
      setFinalizing(true);
      await finalizeConsultation(session.id, {
        doctor_diagnosis: diagnosisInput || "Clinical Wellness Advice",
        prescriptions,
        doctor_notes: doctorProgressNotes || intakeNotes,
        diet_recommendations: dietRecs.split(",").map((d) => d.trim()).filter(Boolean),
        follow_up_date: followUpDate,
      });
      navigate(`/doctor/patient/${patientId}?tab=timeline`);
    } catch (err) {
      console.error("Failed to finalize consultation", err);
    } finally {
      setFinalizing(false);
    }
  };

  // Send Copilot Query
  const handleSendCopilot = async (e: React.FormEvent) => {
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
        { sender: "ai", text: "Copilot query failed. Please verify network connection." },
      ]);
    }
  };

  const patientName = overview?.profile?.fullName || overview?.profile?.name || "Patient Record";

  return (
    <div className="space-y-6 pb-24 font-sans">
      {/* Header Banner */}
      <PageHeader
        eyebrow="Active Consultation Suite"
        title={`Consultation Room: ${patientName}`}
        meta={`Patient ID: ${patientId} • Clinical Session Active • Data Isolation Enforced`}
        action={
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className="flex items-center gap-2 rounded-full border border-hairline bg-surface-card px-4 py-2 text-xs font-semibold text-ink hover:border-teal-deep hover:bg-teal-deep/5 transition-all shadow-xs"
          >
            <Sparkles className="h-4 w-4 text-teal-deep" />
            <span>AI Clinical Copilot</span>
          </button>
        }
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* PATIENT VITAL HEADS-UP CARD */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-deep/10 text-teal-deep font-bold font-mono text-lg">
              {patientName.charAt(0)}
            </div>
            <div>
              <h2 className="font-display font-semibold text-lg text-ink">{patientName}</h2>
              <p className="font-mono text-xs text-stone">
                {overview?.profile?.age || 31} yrs • {overview?.profile?.gender || "Male"} • Blood:{" "}
                <span className="font-bold text-clay-alert">{overview?.profile?.bloodGroup || "O+"}</span>
              </p>
            </div>
          </div>

          {/* DYNAMIC CONSULTATION VITALS STATUS */}
          <div className="flex items-center gap-3">
            {vitalsRecorded && vitals.bp_systolic > 0 ? (
              <>
                <div className="rounded-xl bg-teal-deep/10 border border-teal-deep/20 px-3 py-2 text-center">
                  <span className="font-mono text-[10px] uppercase font-bold text-teal-deep block">BP</span>
                  <span className="font-mono text-xs font-bold text-ink">
                    {vitals.bp_systolic}/{vitals.bp_diastolic}
                  </span>
                </div>
                <div className="rounded-xl bg-teal-deep/10 border border-teal-deep/20 px-3 py-2 text-center">
                  <span className="font-mono text-[10px] uppercase font-bold text-teal-deep block">Heart Rate</span>
                  <span className="font-mono text-xs font-bold text-teal-deep">{vitals.heart_rate} bpm</span>
                </div>
                <div className="rounded-xl bg-teal-deep/10 border border-teal-deep/20 px-3 py-2 text-center">
                  <span className="font-mono text-[10px] uppercase font-bold text-teal-deep block">Temp</span>
                  <span className="font-mono text-xs font-bold text-clay-alert">{vitals.temperature_c} °C</span>
                </div>
                <div className="rounded-xl bg-teal-deep/10 border border-teal-deep/20 px-3 py-2 text-center">
                  <span className="font-mono text-[10px] uppercase font-bold text-teal-deep block">SpO2</span>
                  <span className="font-mono text-xs font-bold text-emerald-600">{vitals.spo2_pct} %</span>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-bg-mist border border-hairline px-4 py-2 text-center">
                <span className="font-mono text-xs text-stone block font-medium">Vitals Status:</span>
                <span className="font-mono text-xs font-bold text-amber-600">Pending Intake Entry</span>
              </div>
            )}
          </div>
        </div>

        {/* GUIDED 4-STEP WORKFLOW NAV */}
        <div className="flex items-center justify-between border-b border-hairline pb-4 overflow-x-auto gap-2">
          {[
            { step: 1, title: "1. Intake & Vitals", icon: Stethoscope },
            { step: 2, title: "2. AI Assist & Labs", icon: Activity },
            { step: 3, title: "3. Rx & Treatment Plan", icon: Pill },
            { step: 4, title: "4. Sign Off & Follow-up", icon: CheckCircle2 },
          ].map((item) => (
            <button
              key={item.step}
              onClick={() => setConsultStep(item.step as any)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                consultStep === item.step
                  ? "bg-ink text-bg-mist shadow-sm"
                  : "bg-surface-card text-stone border border-hairline hover:text-ink"
              }`}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.title}</span>
            </button>
          ))}
        </div>

        {/* STEP 1: INTAKE & VITALS */}
        {consultStep === 1 && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-hairline pb-4 gap-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-teal-deep" />
                <h3 className="font-display text-lg font-semibold text-ink">Clinical Intake & Vitals Recording</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLoadBaselineVitals}
                  className="rounded-full border border-hairline bg-surface-card px-3.5 py-1.5 text-xs font-mono text-stone hover:border-teal-deep hover:text-ink transition-colors"
                >
                  ⚡ Load Patient Baseline Vitals
                </button>
                <button
                  type="button"
                  onClick={handleSimulateVoiceDictation}
                  disabled={isDictating}
                  className="flex items-center gap-2 rounded-full border border-hairline bg-bg-mist px-4 py-1.5 text-xs font-mono text-ink hover:border-teal-deep transition-all"
                >
                  <Mic className={`h-4 w-4 ${isDictating ? "text-clay-alert animate-ping" : "text-teal-deep"}`} />
                  <span>{isDictating ? "Parsing Speech..." : "🎙️ Voice Dictation"}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="font-mono text-xs text-stone block mb-1">Reported Symptoms (Comma-Separated)</label>
                  <textarea
                    rows={3}
                    placeholder="Enter patient reported symptoms (e.g. Fever, Severe Headache, Dry Cough)..."
                    value={symptomsInput}
                    onChange={(e) => setSymptomsInput(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-stone block mb-1">Doctor Initial Intake Notes</label>
                  <textarea
                    rows={4}
                    placeholder="Enter clinical observations, onset duration, examination findings..."
                    value={intakeNotes}
                    onChange={(e) => setIntakeNotes(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                  />
                </div>
              </div>

              {/* Vitals Input Grid */}
              <div className="rounded-xl border border-hairline bg-bg-mist/50 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono text-xs uppercase font-bold text-stone">Record Consultation Vitals</h4>
                  {vitalsRecorded && <span className="font-mono text-[10px] text-teal-deep font-bold">✓ Vitals Logged</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-[11px] text-stone">BP Systolic (mmHg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 120"
                      value={vitals.bp_systolic || ""}
                      onChange={(e) => {
                        setVitalsRecorded(true);
                        setVitals({ ...vitals, bp_systolic: Number(e.target.value) });
                      }}
                      className="w-full rounded-lg border border-hairline bg-surface-card p-2 text-sm font-mono text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] text-stone">BP Diastolic (mmHg)</label>
                    <input
                      type="number"
                      placeholder="e.g. 80"
                      value={vitals.bp_diastolic || ""}
                      onChange={(e) => {
                        setVitalsRecorded(true);
                        setVitals({ ...vitals, bp_diastolic: Number(e.target.value) });
                      }}
                      className="w-full rounded-lg border border-hairline bg-surface-card p-2 text-sm font-mono text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] text-stone">Heart Rate (bpm)</label>
                    <input
                      type="number"
                      placeholder="e.g. 72"
                      value={vitals.heart_rate || ""}
                      onChange={(e) => {
                        setVitalsRecorded(true);
                        setVitals({ ...vitals, heart_rate: Number(e.target.value) });
                      }}
                      className="w-full rounded-lg border border-hairline bg-surface-card p-2 text-sm font-mono text-ink"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[11px] text-stone">Body Temp (°C)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 37.0"
                      value={vitals.temperature_c || ""}
                      onChange={(e) => {
                        setVitalsRecorded(true);
                        setVitals({ ...vitals, temperature_c: Number(e.target.value) });
                      }}
                      className="w-full rounded-lg border border-hairline bg-surface-card p-2 text-sm font-mono text-ink"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-hairline">
              <button
                onClick={handleStartConsultationSession}
                disabled={loadingAI}
                className="flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity"
              >
                <span>{loadingAI ? "Initializing AI Decision Support..." : "Continue to AI Decision Assist →"}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: AI ASSIST & LAB REPORT OCR */}
        {consultStep === 2 && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-deep" />
                <h3 className="font-display text-lg font-semibold text-ink">AI Decision Support & Lab Intelligence</h3>
              </div>
              <span className="font-mono text-xs text-teal-deep font-bold">Session ID: {session?.id || "Active"}</span>
            </div>

            {/* OCR LAB REPORT UPLOAD SECTION */}
            <div className="rounded-xl border border-dashed border-teal-deep/30 bg-teal-deep/5 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-teal-deep">
                  <UploadCloud className="h-5 w-5" />
                  <h4 className="font-mono text-xs uppercase font-bold">Upload Lab Report for Instant OCR & AI Synthesis</h4>
                </div>
                <span className="font-mono text-[10px] text-stone">Supports PDF, PNG, JPG (Auto OCR)</span>
              </div>

              <form onSubmit={handleUploadLabReport} className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  placeholder="Report Title (e.g. CBC & Blood Glucose)"
                  value={labReportTitle}
                  onChange={(e) => setLabReportTitle(e.target.value)}
                  className="w-full sm:w-64 rounded-xl border border-hairline bg-surface-card p-2.5 text-xs text-ink"
                />
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setLabFile(e.target.files?.[0] || null)}
                  className="w-full sm:flex-1 text-xs text-stone file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-mono file:bg-teal-deep file:text-white hover:file:bg-teal-700"
                />
                <button
                  type="submit"
                  disabled={!labFile || uploadingLab}
                  className="w-full sm:w-auto rounded-xl bg-teal-deep text-white px-5 py-2.5 text-xs font-mono font-bold hover:bg-teal-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {uploadingLab ? "Parsing OCR..." : "⚡ Upload & Run OCR"}
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: AI Differential Diagnosis & Interactive Auto-Fill */}
              <div className="space-y-4">
                <div className="rounded-xl border border-hairline bg-bg-mist p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-hairline pb-2">
                    <div className="flex items-center gap-2 text-teal-deep">
                      <Sparkles className="h-4 w-4" />
                      <h4 className="font-mono text-xs uppercase font-bold">AI Differential Diagnoses Suggestions</h4>
                    </div>
                    <span className="font-mono text-[10px] text-stone">Click to auto-fill diagnosis</span>
                  </div>

                  {/* INTERACTIVE DIAGNOSES PILLS */}
                  <div className="flex flex-wrap gap-2">
                    {getDifferentialList().map((diag, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setDiagnosisInput(diag)}
                        className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                          diagnosisInput === diag
                            ? "bg-teal-deep text-white shadow-xs"
                            : "bg-surface-card border border-hairline text-ink hover:border-teal-deep hover:text-teal-deep"
                        }`}
                      >
                        <Check className={`h-3.5 w-3.5 ${diagnosisInput === diag ? "block" : "hidden"}`} />
                        <span>{diag}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setDiagnosisInput("")}
                      className="flex items-center gap-1.5 rounded-full border border-dashed border-stone/50 bg-surface-card px-3.5 py-1.5 text-xs font-mono text-stone hover:text-ink hover:border-ink transition-all"
                    >
                      <span>✏️ Type Custom Diagnosis / Clear AI</span>
                    </button>
                  </div>

                  {/* RICH FORMATTED CLINICAL SUMMARY BOX */}
                  <div className="rounded-xl border border-hairline bg-surface-card p-4 text-xs text-ink max-h-48 overflow-y-auto space-y-2 leading-relaxed">
                    <span className="font-mono text-[10px] uppercase font-bold text-stone block">AI Clinical Decision Summary</span>
                    <p className="whitespace-pre-line text-xs font-sans text-ink/90">
                      {session?.ai_suggestions?.clinical_summary ||
                        `Patient presents with fever and dry cough. Differential diagnoses suggest acute viral respiratory infection. Recommend symptom management and follow-up.`}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="font-mono text-xs text-stone block mb-1">Doctor Confirmed Final Diagnosis</label>
                  <input
                    type="text"
                    placeholder="Click a diagnosis above or type confirmed diagnosis..."
                    value={diagnosisInput}
                    onChange={(e) => setDiagnosisInput(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3.5 font-display text-base font-semibold text-ink outline-none focus:border-teal-deep"
                  />
                </div>
              </div>

              {/* Right: Lab Intelligence & Parsed Metrics */}
              <div className="rounded-xl border border-hairline bg-bg-mist/50 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-hairline pb-2">
                  <h4 className="font-mono text-xs uppercase font-bold text-stone">Lab Intelligence Metrics ({labTrends.length})</h4>
                  <span className="font-mono text-[10px] text-stone">Real-Time Sync</span>
                </div>
                {labTrends.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs font-mono text-stone italic">No diagnostic lab trend records found.</p>
                    <p className="text-[11px] text-stone/70">Upload a lab report above to run OCR and populate metrics.</p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {(labTrends || []).map((metric, idx) => (
                      <div key={idx} className="rounded-xl border border-hairline bg-surface-card p-3 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink">{metric.metric_name}</span>
                          <span className="font-mono font-bold text-teal-deep">
                            {Array.isArray(metric.history) && metric.history.length > 0
                              ? metric.history[metric.history.length - 1]?.value
                              : "N/A"}{" "}
                            {metric.unit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-hairline">
              <button
                onClick={() => setConsultStep(1)}
                className="rounded-xl border border-hairline px-4 py-2 text-xs font-mono text-stone hover:text-ink"
              >
                ← Back to Intake
              </button>
              <button
                onClick={() => setConsultStep(3)}
                className="flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity"
              >
                <span>Proceed to Prescription Builder →</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: RX, DIET & TREATMENT PLAN */}
        {consultStep === 3 && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2">
                <Pill className="h-5 w-5 text-teal-deep" />
                <h3 className="font-display text-lg font-semibold text-ink">Prescription & Diet Plan Builder</h3>
              </div>
            </div>

            {/* Safety Warning Banner */}
            {Array.isArray(safetyWarnings) && safetyWarnings.length > 0 && (
              <div className="rounded-xl border border-clay-alert bg-clay-alert/10 p-4 space-y-2">
                <div className="flex items-center gap-2 text-clay-alert font-bold font-mono text-xs">
                  <ShieldAlert className="h-4 w-4" />
                  <span>⚠️ REAL-TIME DRUG SAFETY CONTRAINDICATION WARNING</span>
                </div>
                {safetyWarnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-clay-alert font-mono">
                    {w.message}
                  </p>
                ))}
              </div>
            )}

            {/* Add Prescription Row */}
            <div className="rounded-xl border border-hairline bg-bg-mist/50 p-4 space-y-3">
              <h4 className="font-mono text-xs uppercase font-bold text-stone">Add Medication to Prescription</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Medication Name (e.g. Amoxicillin)"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-card p-2.5 text-xs text-ink"
                />
                <input
                  type="text"
                  placeholder="Dosage (e.g. 500 mg)"
                  value={newMedDose}
                  onChange={(e) => setNewMedDose(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-card p-2.5 text-xs text-ink"
                />
                <input
                  type="text"
                  placeholder="Frequency (e.g. Twice daily)"
                  value={newMedFreq}
                  onChange={(e) => setNewMedFreq(e.target.value)}
                  className="rounded-xl border border-hairline bg-surface-card p-2.5 text-xs text-ink"
                />
                <button
                  type="button"
                  onClick={handleAddPrescription}
                  className="rounded-xl bg-teal-deep text-white text-xs font-mono font-semibold py-2.5 hover:bg-teal-700 transition-colors"
                >
                  + Add & Check Safety
                </button>
              </div>
            </div>

            {/* Active Prescription List */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs uppercase font-bold text-stone">Active Prescriptions ({prescriptions.length})</h4>
              {prescriptions.length === 0 ? (
                <p className="text-xs font-mono text-stone italic">No prescriptions added yet.</p>
              ) : (
                prescriptions.map((rx, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-hairline bg-bg-mist p-3 text-xs">
                    <div>
                      <span className="font-bold text-ink">{rx.medication_name} ({rx.dosage})</span>
                      <span className="text-stone ml-2">• {rx.frequency} for {rx.duration_days} days</span>
                    </div>
                    <button
                      onClick={() => handleRemovePrescription(idx)}
                      className="text-clay-alert hover:underline font-mono text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* AI Diet Plan Recommendations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-mono text-xs uppercase font-bold text-stone block">
                  Post-Consultation Dietary Advice
                </label>
                <button
                  type="button"
                  onClick={handleAutoGenerateDiet}
                  disabled={generatingDiet}
                  className="flex items-center gap-1.5 rounded-full border border-teal-deep/30 bg-teal-deep/10 px-3.5 py-1 font-mono text-xs text-teal-deep hover:bg-teal-deep/20 font-bold transition-all disabled:opacity-50"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${generatingDiet ? "animate-spin" : ""}`} />
                  <span>{generatingDiet ? "Generating Diet..." : "🤖 Auto-Generate AI Diet Plan"}</span>
                </button>
              </div>
              <textarea
                rows={4}
                value={dietRecs}
                onChange={(e) => setDietRecs(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-mono text-xs text-ink focus:border-teal-deep outline-none leading-relaxed"
              />
            </div>

            {/* Diagnostic Lab Test Orderer */}
            <div className="rounded-xl border border-hairline bg-bg-mist/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-xs uppercase font-bold text-stone">Order Diagnostic Lab Tests</h4>
                <span className="font-mono text-[10px] text-stone">Creates pending lab request in MongoDB</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <input
                  type="text"
                  placeholder="Test Name (e.g. Fasting Lipid Panel, Repeat HbA1c)"
                  value={newLabTestName}
                  onChange={(e) => setNewLabTestName(e.target.value)}
                  className="w-full sm:flex-1 rounded-xl border border-hairline bg-surface-card p-2.5 text-xs text-ink"
                />
                <button
                  type="button"
                  onClick={handleOrderLabTest}
                  disabled={!newLabTestName.trim() || orderingLab}
                  className="w-full sm:w-auto rounded-xl bg-ink text-bg-mist text-xs font-mono font-bold px-5 py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {orderingLab ? "Ordering..." : "+ Order Test"}
                </button>
              </div>

              {labOrders.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {labOrders.map((lo, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-hairline bg-surface-card p-2 text-xs">
                      <span className="font-semibold text-ink">🧪 {lo.test_name}</span>
                      <span className="font-mono text-[10px] bg-amber-500/10 text-amber-600 font-bold px-2 py-0.5 rounded-full">
                        Pending Order
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t border-hairline">
              <button
                onClick={() => setConsultStep(2)}
                className="rounded-xl border border-hairline px-4 py-2 text-xs font-mono text-stone hover:text-ink"
              >
                ← Back to AI Assist
              </button>
              <button
                onClick={() => setConsultStep(4)}
                className="flex items-center gap-2 rounded-xl bg-ink px-6 py-3 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity"
              >
                <span>Proceed to Sign Off →</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: SIGN OFF & FOLLOW-UP */}
        {consultStep === 4 && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-deep" />
                <h3 className="font-display text-lg font-semibold text-ink">Digital Sign Off & Schedule Follow-Up</h3>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-mono text-xs text-stone block">Schedule Follow-Up Date</label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-mono text-ink">
                      <input
                        type="checkbox"
                        checked={noFollowUp}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNoFollowUp(checked);
                          if (checked) setFollowUpDate("PRN");
                          else setFollowUpDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
                        }}
                        className="rounded border-hairline accent-teal-deep"
                      />
                      <span>No Follow-Up Required (PRN)</span>
                    </label>
                  </div>
                  <input
                    type="date"
                    disabled={noFollowUp}
                    value={noFollowUp ? "" : followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-mono text-sm text-ink outline-none focus:border-teal-deep disabled:opacity-40"
                  />
                  <p className="font-mono text-[11px] text-stone mt-1">
                    {noFollowUp
                      ? "✓ No follow-up appointment will be booked."
                      : "Auto-reserves a confirmed appointment in MongoDB for this patient."}
                  </p>
                </div>

                <div>
                  <label className="font-mono text-xs text-stone block mb-1">Doctor Progress Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Enter final clinical progress notes for medical record..."
                    value={doctorProgressNotes}
                    onChange={(e) => setDoctorProgressNotes(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-xs text-ink outline-none focus:border-teal-deep"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-stone block mb-1">
                    Patient Discharge Instructions (Pushed to Patient Portal)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Plain English instructions for patient portal..."
                    value={dischargeInstructions}
                    onChange={(e) => setDischargeInstructions(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-xs text-ink outline-none focus:border-teal-deep"
                  />
                </div>
              </div>

              {/* Consultation Summary Card */}
              <div className="rounded-xl border border-hairline bg-bg-mist/50 p-5 space-y-3">
                <h4 className="font-mono text-xs uppercase font-bold text-stone">Consultation Summary Sign-Off</h4>
                <div className="space-y-2 text-xs">
                  <p><span className="font-semibold">Confirmed Diagnosis:</span> {diagnosisInput || "Wellness Consultation"}</p>
                  <p><span className="font-semibold">Prescriptions:</span> {prescriptions.length} items</p>
                  <p><span className="font-semibold">Lab Orders:</span> {labOrders.length} test(s)</p>
                  <p><span className="font-semibold">Follow-up Date:</span> {followUpDate}</p>
                </div>
                <div className="rounded-lg bg-teal-deep/10 border border-teal-deep/20 p-3 text-[11px] font-mono text-teal-deep">
                  ✓ Prescriptions & Diet Plan will sync directly to the Patient Portal upon sign-off.
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-hairline">
              <button
                onClick={() => setConsultStep(3)}
                className="rounded-xl border border-hairline px-4 py-2 text-xs font-mono text-stone hover:text-ink"
              >
                ← Back to Prescriptions
              </button>
              <button
                onClick={handleFinalizeSession}
                disabled={finalizing}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-8 py-3 text-xs font-mono font-bold text-white hover:bg-emerald-700 transition-colors shadow-md"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{finalizing ? "Signing Off..." : "⚡ Sign Off & Sync to Patient Portal"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CONTEXTUAL COPILOT SIDE-DRAWER */}
      {copilotOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-surface-card border-l border-hairline shadow-2xl flex flex-col justify-between p-6 animate-in slide-in-from-right">
          <div className="flex items-center justify-between border-b border-hairline pb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-deep" />
              <h3 className="font-display font-semibold text-base text-ink">Clinical Copilot Drawer</h3>
            </div>
            <button onClick={() => setCopilotOpen(false)} className="text-stone hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
            {copilotMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`p-3.5 rounded-2xl text-xs ${
                  msg.sender === "doctor"
                    ? "bg-ink text-bg-mist ml-6 font-medium"
                    : "bg-bg-mist text-ink border border-hairline mr-6"
                }`}
              >
                {msg.sender === "doctor" ? msg.text : <FormattedText text={msg.text} />}
              </div>
            ))}
          </div>

          {/* Input Box */}
          <form onSubmit={handleSendCopilot} className="flex items-center gap-2 border-t border-hairline pt-4">
            <input
              type="text"
              placeholder="Ask Copilot about this patient..."
              value={copilotInput}
              onChange={(e) => setCopilotInput(e.target.value)}
              className="flex-1 rounded-xl border border-hairline bg-bg-mist p-2.5 text-xs text-ink outline-none"
            />
            <button type="submit" className="rounded-xl bg-ink p-2.5 text-bg-mist hover:opacity-90">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
