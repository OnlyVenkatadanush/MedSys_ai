import React, { useState } from "react";
import { createConsultation, finalizeConsultation, triggerAIDecisionSupport } from "@/services/clinicalService";
import type { ConsultationSession, PrescriptionItem, Vitals } from "@/types";

interface Props {
  patientId: string;
  patientName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ConsultationSessionModal: React.FC<Props> = ({
  patientId,
  patientName,
  onClose,
  onSuccess,
}) => {
  const [step, setStep] = useState<"intake" | "ai_review" | "finalize">("intake");
  const [symptomsInput, setSymptomsInput] = useState<string>("Fever, Severe Headache, Dry Cough");
  const [vitals, setVitals] = useState<Vitals>({
    bp_systolic: 135,
    bp_diastolic: 85,
    heart_rate: 78,
    temperature_c: 38.2,
    spo2_pct: 98,
  });
  const [doctorNotes, setDoctorNotes] = useState<string>("Patient reports onset 2 days ago.");
  
  const [session, setSession] = useState<ConsultationSession | null>(null);
  const [loadingAI, setLoadingAI] = useState<boolean>(false);

  // Finalization fields
  const [finalDiagnosis, setFinalDiagnosis] = useState<string>("");
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [dietRecs, setDietRecs] = useState<string>("Increase liquid intake, light digestible food.");
  const [followUpDate, setFollowUpDate] = useState<string>("2026-09-10");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const handleStartSession = async () => {
    try {
      const symptoms = symptomsInput.split(",").map((s) => s.trim()).filter(Boolean);
      const created = await createConsultation({
        patient_id: patientId,
        symptoms,
        vitals,
        doctor_notes: doctorNotes,
      });
      setSession(created);
      
      // Auto trigger AI Assistant
      setLoadingAI(true);
      setStep("ai_review");
      const aiUpdated = await triggerAIDecisionSupport(created.id);
      setSession(aiUpdated);

      if (aiUpdated.ai_suggestions) {
        setFinalDiagnosis(aiUpdated.ai_suggestions.differential_diagnoses[0] || "Acute Viral Infection");
        setPrescriptions(aiUpdated.ai_suggestions.suggested_prescriptions || []);
      }
    } catch (err) {
      console.error("Failed to start session", err);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleFinalize = async () => {
    if (!session) return;
    try {
      setSubmitting(true);
      await finalizeConsultation(session.id, {
        doctor_diagnosis: finalDiagnosis,
        prescriptions,
        doctor_notes: doctorNotes,
        diet_recommendations: dietRecs.split(",").map((d) => d.trim()),
        follow_up_date: followUpDate,
      });
      onSuccess();
    } catch (err) {
      console.error("Failed to finalize consultation", err);
    } finally {
      setSubmitting(false);
    }
  };

  const addPrescriptionRow = () => {
    setPrescriptions([
      ...prescriptions,
      {
        medication_name: "Amoxicillin",
        dosage: "500 mg",
        frequency: "Three times daily",
        duration_days: 7,
        instructions: "Take after food",
      },
    ]);
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto font-sans">
      <div className="bg-surface-card border border-hairline rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 text-ink my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <div>
            <h2 className="font-display text-xl tracking-tight text-ink">
              Clinical Consultation: <span className="text-teal-deep">{patientName}</span>
            </h2>
            <p className="font-mono text-xs text-stone mt-0.5">
              Doctor Intake, AI Decision Support & Official Sign-off
            </p>
          </div>
          <button onClick={onClose} className="text-stone hover:text-ink font-bold text-lg">
            ✕
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between bg-bg-mist p-2 rounded-xl border border-hairline font-mono text-xs">
          <span className={`px-3 py-1 rounded-lg ${step === "intake" ? "bg-ink text-bg-mist font-bold" : "text-stone"}`}>
            1. Symptoms & Vitals
          </span>
          <span className={`px-3 py-1 rounded-lg ${step === "ai_review" ? "bg-ink text-bg-mist font-bold" : "text-stone"}`}>
            2. AI Decision Support
          </span>
          <span className={`px-3 py-1 rounded-lg ${step === "finalize" ? "bg-ink text-bg-mist font-bold" : "text-stone"}`}>
            3. Doctor Sign-off
          </span>
        </div>

        {/* Step 1: Intake Form */}
        {step === "intake" && (
          <div className="space-y-4">
            <div>
              <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                Patient Symptoms (comma-separated):
              </label>
              <input
                type="text"
                value={symptomsInput}
                onChange={(e) => setSymptomsInput(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="font-mono text-[11px] text-stone block mb-1">BP Systolic</label>
                <input
                  type="number"
                  value={vitals.bp_systolic || 120}
                  onChange={(e) => setVitals({ ...vitals, bp_systolic: Number(e.target.value) })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-2 text-sm text-ink"
                />
              </div>
              <div>
                <label className="font-mono text-[11px] text-stone block mb-1">BP Diastolic</label>
                <input
                  type="number"
                  value={vitals.bp_diastolic || 80}
                  onChange={(e) => setVitals({ ...vitals, bp_diastolic: Number(e.target.value) })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-2 text-sm text-ink"
                />
              </div>
              <div>
                <label className="font-mono text-[11px] text-stone block mb-1">Heart Rate</label>
                <input
                  type="number"
                  value={vitals.heart_rate || 75}
                  onChange={(e) => setVitals({ ...vitals, heart_rate: Number(e.target.value) })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-2 text-sm text-ink"
                />
              </div>
              <div>
                <label className="font-mono text-[11px] text-stone block mb-1">Temp (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  value={vitals.temperature_c || 37.0}
                  onChange={(e) => setVitals({ ...vitals, temperature_c: Number(e.target.value) })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-2 text-sm text-ink"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Doctor Notes:</label>
              <textarea
                rows={2}
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-full text-sm text-stone hover:text-ink">
                Cancel
              </button>
              <button
                onClick={handleStartSession}
                className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-bg-mist transition-opacity hover:opacity-90 shadow-sm"
              >
                Generate AI Decision Support →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: AI Review */}
        {step === "ai_review" && (
          <div className="space-y-4">
            {loadingAI ? (
              <div className="py-12 text-center space-y-3 font-mono text-sm text-stone">
                <div className="animate-spin h-7 w-7 border-2 border-teal-deep border-t-transparent rounded-full mx-auto"></div>
                <p>AI Clinical Decision Support analyzing symptoms & drug interactions...</p>
              </div>
            ) : session?.ai_suggestions ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-wider text-teal-deep font-semibold">
                      AI Differential Diagnosis Candidates:
                    </span>
                    <span className="font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-clay-alert/10 text-clay-alert border border-clay-alert/20">
                      Draft Mode (Requires Doctor Approval)
                    </span>
                  </div>
                  <ul className="font-display text-base text-ink list-disc list-inside space-y-1">
                    {session.ai_suggestions.differential_diagnoses.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>

                {session.ai_suggestions.drug_interaction_warnings.length > 0 && (
                  <div className="rounded-xl border border-clay-alert/30 bg-clay-alert/5 p-4 space-y-1">
                    <span className="font-mono text-xs uppercase tracking-wider text-clay-alert font-bold block">
                      ⚠️ Drug Safety & Interaction Warnings:
                    </span>
                    <ul className="text-xs text-ink list-disc list-inside space-y-1">
                      {session.ai_suggestions.drug_interaction_warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl border border-hairline bg-bg-mist p-4">
                  <span className="font-mono text-xs uppercase tracking-wider text-stone block mb-2">
                    Candidate Prescriptions Proposed by AI:
                  </span>
                  <div className="space-y-2">
                    {session.ai_suggestions.suggested_prescriptions.map((rx, idx) => (
                      <div key={idx} className="rounded-lg border border-hairline bg-surface-card p-3 text-xs flex justify-between">
                        <div>
                          <strong className="text-ink text-sm font-semibold">{rx.medication_name}</strong> - {rx.dosage} ({rx.frequency})
                        </div>
                        <span className="font-mono text-stone">{rx.duration_days} days</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setStep("finalize")}
                    className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-bg-mist transition-opacity hover:opacity-90 shadow-sm"
                  >
                    Proceed to Review & Sign Off →
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Step 3: Finalize */}
        {step === "finalize" && (
          <div className="space-y-4">
            <div>
              <label className="font-mono text-xs uppercase tracking-wider text-teal-deep font-semibold block mb-1">
                Doctor Final Diagnosis:
              </label>
              <input
                type="text"
                value={finalDiagnosis}
                onChange={(e) => setFinalDiagnosis(e.target.value)}
                className="w-full rounded-xl border border-teal-deep/40 bg-bg-mist p-3 font-display text-lg text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-xs uppercase tracking-wider text-stone font-semibold">
                  Official Prescriptions:
                </label>
                <button
                  type="button"
                  onClick={addPrescriptionRow}
                  className="font-mono text-xs text-teal-deep hover:underline font-semibold"
                >
                  + Add Medication
                </button>
              </div>
              <div className="space-y-2">
                {prescriptions.map((rx, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 rounded-xl border border-hairline bg-bg-mist p-3 items-center">
                    <input
                      type="text"
                      placeholder="Medication Name"
                      value={rx.medication_name}
                      onChange={(e) => {
                        const updated = [...prescriptions];
                        updated[i].medication_name = e.target.value;
                        setPrescriptions(updated);
                      }}
                      className="col-span-4 rounded-lg border border-hairline bg-surface-card p-2 text-xs text-ink"
                    />
                    <input
                      type="text"
                      placeholder="Dosage"
                      value={rx.dosage}
                      onChange={(e) => {
                        const updated = [...prescriptions];
                        updated[i].dosage = e.target.value;
                        setPrescriptions(updated);
                      }}
                      className="col-span-3 rounded-lg border border-hairline bg-surface-card p-2 text-xs text-ink"
                    />
                    <input
                      type="text"
                      placeholder="Frequency"
                      value={rx.frequency}
                      onChange={(e) => {
                        const updated = [...prescriptions];
                        updated[i].frequency = e.target.value;
                        setPrescriptions(updated);
                      }}
                      className="col-span-3 rounded-lg border border-hairline bg-surface-card p-2 text-xs text-ink"
                    />
                    <button
                      type="button"
                      onClick={() => setPrescriptions(prescriptions.filter((_, idx) => idx !== i))}
                      className="col-span-2 text-xs text-clay-alert font-mono font-bold hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                  Diet Recommendations:
                </label>
                <input
                  type="text"
                  value={dietRecs}
                  onChange={(e) => setDietRecs(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-2.5 text-xs text-ink"
                />
              </div>
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                  Follow-up Date:
                </label>
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-2.5 text-xs text-ink font-mono"
                />
              </div>
            </div>

            <div className="rounded-xl border border-teal-deep/30 bg-teal-deep/5 p-3 font-mono text-xs text-teal-deep flex items-center gap-2">
              <span>🔒</span>
              <span>Signing off publishes diagnosis, prescriptions, and diet directly to patient's care portal.</span>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setStep("ai_review")} className="px-4 py-2 text-xs font-mono text-stone hover:text-ink">
                ← Back
              </button>
              <button
                onClick={handleFinalize}
                disabled={submitting}
                className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-bg-mist transition-opacity hover:opacity-90 shadow-sm disabled:opacity-50"
              >
                {submitting ? "Publishing..." : "Doctor Sign Off & Publish Advice"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
