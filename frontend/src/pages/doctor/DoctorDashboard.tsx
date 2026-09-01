import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchAssignedPatients, fetchPatientTimeline } from "@/services/clinicalService";
import type { ConsultationSession, DoctorPatientAssignment } from "@/types";
import { ConsultationSessionModal } from "./ConsultationSessionModal";

export const DoctorDashboard: React.FC = () => {
  const [patients, setPatients] = useState<DoctorPatientAssignment[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("pat_01");
  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showConsultModal, setShowConsultModal] = useState<boolean>(false);

  useEffect(() => {
    loadPatients();
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      loadTimeline(selectedPatientId);
    }
  }, [selectedPatientId]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const data = await fetchAssignedPatients();
      setPatients(data);
      if (data.length > 0) {
        setSelectedPatientId(data[0].patient_id);
      }
    } catch (err) {
      console.error("Failed to load patients", err);
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async (patientId: string) => {
    try {
      const data = await fetchPatientTimeline(patientId);
      setTimeline(data);
    } catch (err) {
      console.error("Failed to load patient timeline", err);
    }
  };

  const selectedPatient = patients.find((p) => p.patient_id === selectedPatientId) || null;

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Clinical Decision Support Workspace"
        title="Doctor Portal"
        meta="Manage assigned patient health records, conduct AI-assisted consultations, and sign off on care plans."
        action={
          <button
            onClick={() => setShowConsultModal(true)}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-bg-mist transition-opacity hover:opacity-90 shadow-sm flex items-center gap-2"
          >
            <span>+</span> Start Consultation
          </button>
        }
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* Active Patient Switcher Header Bar */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs uppercase tracking-wider text-stone font-semibold">Active Patient:</span>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="rounded-xl border border-hairline bg-bg-mist px-3 py-2 text-sm font-display font-medium text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.patient_id}>
                  {p.patient_name} ({p.patient_age}y, {p.patient_gender || "N/A"})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-stone">
            <span className="h-2 w-2 rounded-full bg-teal-deep"></span>
            <span>Clinical Data Isolation Active</span>
          </div>
        </div>

        {/* Main Grid: Patients List & Medical Timeline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Assigned Patients */}
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
            <h2 className="font-display text-lg tracking-tight text-ink flex items-center justify-between">
              <span>Assigned Patients</span>
              <span className="font-mono text-xs text-stone">({patients.length})</span>
            </h2>
            <div className="space-y-3">
              {patients.length === 0 && !loading && (
                <p className="font-mono text-xs text-stone italic">No patients assigned yet.</p>
              )}
              {patients.map((p) => {
                const isSelected = p.patient_id === selectedPatientId;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.patient_id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-bg-mist border-ink shadow-xs"
                        : "bg-surface-card border-hairline hover:bg-bg-mist/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-base text-ink">{p.patient_name}</span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-teal-deep/10 text-teal-deep font-semibold">
                        Active
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-xs text-stone mt-2">
                      <span>{p.patient_age != null ? `${p.patient_age}y` : "—"}</span>
                      <span>•</span>
                      <span>{p.patient_gender || "—"}</span>
                      <span>•</span>
                      <span>ID: {p.patient_id}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Timeline & Consultation History */}
          <div className="lg:col-span-2 rounded-2xl border border-hairline bg-surface-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div>
                <h2 className="font-display text-xl tracking-tight text-ink">
                  Clinical Timeline: {selectedPatient?.patient_name || "No patient selected"}
                </h2>
                <p className="font-mono text-xs text-stone mt-1">
                  Full patient medical records, past doctor sign-offs, and lab documents.
                </p>
              </div>
              <button
                onClick={() => setShowConsultModal(true)}
                className="rounded-full border border-hairline bg-bg-mist px-4 py-1.5 text-xs font-medium text-ink hover:bg-surface-card transition-colors"
              >
                + New Session
              </button>
            </div>

            {timeline ? (
              <div className="space-y-6">
                {/* Vitals Summary Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-hairline bg-bg-mist p-3">
                    <span className="font-mono text-[11px] text-stone uppercase tracking-wider block">Age / Gender</span>
                    <span className="font-display text-sm text-ink font-semibold">
                      {timeline.profile?.age != null ? `${timeline.profile.age}y` : "—"} / {selectedPatient?.patient_gender || "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-hairline bg-bg-mist p-3">
                    <span className="font-mono text-[11px] text-stone uppercase tracking-wider block">Blood Group</span>
                    <span className="font-display text-sm text-clay-alert font-semibold">
                      {timeline.profile?.bloodGroup || "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-hairline bg-bg-mist p-3">
                    <span className="font-mono text-[11px] text-stone uppercase tracking-wider block">Weight / BMI</span>
                    <span className="font-display text-sm text-teal-deep font-semibold">
                      {timeline.profile?.weightKg != null ? `${timeline.profile.weightKg} kg` : "—"}
                    </span>
                  </div>
                  <div className="rounded-xl border border-hairline bg-bg-mist p-3">
                    <span className="font-mono text-[11px] text-stone uppercase tracking-wider block">Chronic Conditions</span>
                    <span className="font-sans text-xs text-ink font-medium">
                      {timeline.profile?.conditions?.length ? timeline.profile.conditions.join(", ") : "None recorded"}
                    </span>
                  </div>
                </div>

                {/* Consultations List */}
                <div className="space-y-4">
                  <h3 className="font-mono text-xs uppercase tracking-wider text-stone font-semibold">
                    Past Clinical Consultations ({timeline.consultations?.length || 0})
                  </h3>
                  {timeline.consultations?.length > 0 ? (
                    timeline.consultations.map((c: ConsultationSession) => (
                      <div key={c.id} className="rounded-xl border border-hairline bg-bg-mist/60 p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] uppercase font-semibold ${
                                c.status === "finalized"
                                  ? "bg-teal-deep/10 text-teal-deep border border-teal-deep/20"
                                  : "bg-clay-alert/10 text-clay-alert border border-clay-alert/20"
                              }`}
                            >
                              {c.status === "finalized" ? "✓ Finalized & Signed Off" : "Draft"}
                            </span>
                            <span className="font-mono text-xs text-stone">
                              {new Date(c.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="font-mono text-xs text-teal-deep font-medium">{c.doctor_name}</span>
                        </div>

                        <div>
                          <span className="font-mono text-xs text-stone block">Symptoms Reported:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {c.symptoms.map((s, idx) => (
                              <span key={idx} className="rounded-lg border border-hairline bg-surface-card px-2 py-0.5 font-sans text-xs text-ink">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>

                        {c.doctor_diagnosis && (
                          <div className="rounded-lg border border-hairline bg-surface-card p-3">
                            <span className="font-mono text-xs uppercase tracking-wider text-teal-deep font-semibold block mb-0.5">
                              Doctor Final Diagnosis:
                            </span>
                            <p className="font-display text-base text-ink">{c.doctor_diagnosis}</p>
                          </div>
                        )}

                        {c.prescriptions && c.prescriptions.length > 0 && (
                          <div>
                            <span className="font-mono text-xs text-stone block mb-1">Prescribed Medications:</span>
                            <div className="space-y-1">
                              {c.prescriptions.map((rx, idx) => (
                                <div key={idx} className="rounded-lg border border-hairline bg-surface-card p-2 text-xs flex justify-between">
                                  <span className="font-semibold text-ink">{rx.medication_name} ({rx.dosage})</span>
                                  <span className="font-mono text-stone">{rx.frequency}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="font-mono text-xs text-stone italic">No past consultations recorded for this patient.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center font-mono text-xs text-stone">Loading patient timeline...</div>
            )}
          </div>
        </div>
      </div>

      {showConsultModal && selectedPatient && (
        <ConsultationSessionModal
          patientId={selectedPatientId}
          patientName={selectedPatient.patient_name}
          onClose={() => setShowConsultModal(false)}
          onSuccess={() => {
            setShowConsultModal(false);
            loadTimeline(selectedPatientId);
          }}
        />
      )}
    </div>
  );
};
