import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { PageHeader } from "@/components/PageHeader";
import { fetchPatientDashboard, logMedicationDose } from "@/services/clinicalService";
import { getProfile } from "@/services/profile";
import type { ConsultationSession, MedicationSchedule } from "@/types";

export const PatientDashboard: React.FC = () => {
  const { user } = useUser();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [patientName, setPatientName] = useState<string>("");

  useEffect(() => {
    loadDashboard();
    getProfile()
      .then((p) => {
        if (p?.fullName) {
          setPatientName(p.fullName.split(" ")[0]);
        }
      })
      .catch(() => {});
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const data = await fetchPatientDashboard();
      setDashboard(data);
    } catch (err) {
      console.error("Failed to load patient dashboard", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTakeDose = async (med: MedicationSchedule) => {
    try {
      await logMedicationDose({
        medication_id: med.id,
        medication_name: med.medication_name,
        dosage: med.dosage,
        status: "taken",
      });
      loadDashboard();
    } catch (err) {
      console.error("Failed to log dose", err);
    }
  };

  const displayName = patientName || user?.firstName || user?.fullName?.split(" ")[0] || "Patient";

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Personal Care Portal"
        title={`Welcome back, ${displayName}.`}
        meta="View your doctor-approved care plan, track medication schedules, and consult your AI assistant."
        action={
          <div className="flex items-center gap-2">
            <Link
              to="/patient/chat"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg-mist transition-opacity hover:opacity-90 shadow-sm flex items-center gap-2"
            >
              <span>💬</span> AI Chatbot
            </Link>
          </div>
        }
      />

      {loading ? (
        <div className="px-5 py-12 text-center font-mono text-sm text-stone sm:px-8">
          Loading your personal care plan…
        </div>
      ) : (
        <div className="px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column: Published Doctor Advice & Care Plan */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <h2 className="font-display text-lg tracking-tight text-ink flex items-center gap-2">
                  <span>🩺</span> Doctor-Approved Advice & Prescriptions
                </h2>
                <span className="font-mono text-[10px] uppercase font-semibold text-teal-deep bg-teal-deep/10 px-2.5 py-1 rounded-full border border-teal-deep/20">
                  Verified by Doctor
                </span>
              </div>

              {Array.isArray(dashboard?.recent_doctor_advice) && dashboard.recent_doctor_advice.length > 0 ? (
                dashboard.recent_doctor_advice.map((advice: ConsultationSession) => (
                  <div key={advice.id} className="rounded-xl border border-hairline bg-bg-mist/60 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-teal-deep"></span>
                        <span className="font-display text-base text-ink">{advice.doctor_name}</span>
                      </div>
                      <span className="font-mono text-xs text-stone">
                        Published: {new Date(advice.signed_off_at || advice.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="rounded-xl border border-hairline bg-surface-card p-4">
                      <span className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                        Doctor Final Diagnosis:
                      </span>
                      <p className="font-display text-lg text-ink font-medium">{advice.doctor_diagnosis}</p>
                    </div>

                    {advice.prescriptions && advice.prescriptions.length > 0 && (
                      <div>
                        <span className="font-mono text-xs uppercase tracking-wider text-stone block mb-2">
                          Prescribed Medication Schedule:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {advice.prescriptions.map((rx, idx) => (
                            <div key={idx} className="rounded-lg border border-hairline bg-surface-card p-3 space-y-1">
                              <span className="font-semibold text-ink text-sm block">{rx.medication_name}</span>
                              <span className="font-mono text-xs text-stone block">Dose: {rx.dosage}</span>
                              <span className="font-mono text-xs text-teal-deep block">{rx.frequency}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {advice.doctor_notes && (
                      <div>
                        <span className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                          Doctor Clinical Instructions:
                        </span>
                        <p className="text-xs text-ink leading-relaxed rounded-lg border border-hairline bg-surface-card p-3">
                          {advice.doctor_notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <p className="font-mono text-xs text-stone italic">No published doctor advice recorded yet.</p>
              )}
            </div>

            {/* Diet Guidelines */}
            <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <h2 className="font-display text-lg tracking-tight text-ink flex items-center gap-2">
                  <span>🥗</span> Doctor Dietary Guidelines
                </h2>
                <Link to="/patient/diet" className="font-mono text-xs text-teal-deep hover:underline font-semibold">
                  Manage Meals →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-teal-deep/30 bg-teal-deep/5 p-4 space-y-1">
                  <span className="font-mono text-xs font-bold text-teal-deep block mb-1">✓ Recommended Foods</span>
                  <ul className="text-xs text-ink list-disc list-inside space-y-1">
                    {(dashboard?.diet_plan?.allowed_foods || ["Fresh fruits", "Whole grains"]).map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-clay-alert/30 bg-clay-alert/5 p-4 space-y-1">
                  <span className="font-mono text-xs font-bold text-clay-alert block mb-1">✕ Foods to Restrict</span>
                  <ul className="text-xs text-ink list-disc list-inside space-y-1">
                    {(dashboard?.diet_plan?.restricted_foods || ["Excess sodium", "Processed sugar"]).map((item: string, i: number) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar: Active Medication Schedule */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-hairline pb-3">
                <h2 className="font-display text-lg tracking-tight text-ink flex items-center gap-2">
                  <span>⏰</span> Active Pill Reminders
                </h2>
                <Link to="/patient/medications" className="font-mono text-xs text-teal-deep hover:underline font-semibold">
                  View All →
                </Link>
              </div>

              <div className="space-y-3">
                {dashboard?.active_medications?.map((med: MedicationSchedule) => (
                  <div key={med.id} className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-ink text-sm">{med.medication_name}</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-teal-deep/10 text-teal-deep font-semibold">
                        {med.dosage}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-stone">{med.frequency}</p>
                    <button
                      onClick={() => handleTakeDose(med)}
                      className="w-full rounded-lg bg-ink py-2 text-xs font-medium text-bg-mist hover:opacity-90 transition-opacity mt-1"
                    >
                      ✓ Log Dose as Taken
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-3">
              <h3 className="font-mono text-xs uppercase tracking-wider text-stone font-semibold">Quick Tools</h3>
              <Link
                to="/patient/chat"
                className="block p-3 rounded-xl border border-hairline bg-bg-mist hover:bg-surface-card font-mono text-xs font-medium text-ink transition-colors"
              >
                💬 Ask Clarification AI Assistant →
              </Link>
              <Link
                to="/patient/lab-reports"
                className="block p-3 rounded-xl border border-hairline bg-bg-mist hover:bg-surface-card font-mono text-xs font-medium text-ink transition-colors"
              >
                📑 View Lab Reports & OCR Extractor →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
