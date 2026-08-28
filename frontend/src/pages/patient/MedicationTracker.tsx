import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchPatientMedications, logMedicationDose } from "@/services/clinicalService";
import type { MedicationLogRecord, MedicationSchedule } from "@/types";

export const MedicationTracker: React.FC = () => {
  const [schedules, setSchedules] = useState<MedicationSchedule[]>([]);
  const [logs, setLogs] = useState<MedicationLogRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadMedications();
  }, []);

  const loadMedications = async () => {
    try {
      setLoading(true);
      const data = await fetchPatientMedications();
      setSchedules(data.schedules);
      setLogs(data.logs);
    } catch (err) {
      console.error("Failed to fetch medications", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLog = async (med: MedicationSchedule, status: "taken" | "skipped") => {
    try {
      await logMedicationDose({
        medication_id: med.id,
        medication_name: med.medication_name,
        dosage: med.dosage,
        status,
      });
      loadMedications();
    } catch (err) {
      console.error("Failed to log dose", err);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Medication Schedule & Adherence"
        title="Medication Tracker"
        meta="Track active prescriptions from your doctor, confirm taken doses, and review your adherence log."
      />

      {loading ? (
        <div className="px-5 py-12 text-center font-mono text-sm text-stone sm:px-8">
          Loading medication schedule…
        </div>
      ) : (
        <div className="px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Medication Schedules */}
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
            <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
              Active Prescriptions ({schedules.length})
            </h2>
            <div className="space-y-4">
              {schedules.map((med) => (
                <div key={med.id} className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-base text-ink font-semibold">{med.medication_name}</span>
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-teal-deep/10 text-teal-deep font-semibold">
                      {med.dosage}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-stone space-y-1">
                    <p>Frequency: {med.frequency}</p>
                    <p>Times/Day: {med.times_per_day}</p>
                    <p className="text-stone/70">Started: {med.start_date}</p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleLog(med, "taken")}
                      className="flex-1 rounded-lg bg-ink py-2 text-xs font-medium text-bg-mist hover:opacity-90 transition-opacity"
                    >
                      ✓ Confirm Taken
                    </button>
                    <button
                      onClick={() => handleLog(med, "skipped")}
                      className="px-4 rounded-lg border border-hairline bg-surface-card py-2 text-xs font-mono text-stone hover:text-ink transition-colors"
                    >
                      Skipped
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dose Adherence & Intake Log */}
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
            <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
              Dose Compliance History
            </h2>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log.id} className="rounded-xl border border-hairline bg-bg-mist p-3 flex items-center justify-between font-mono text-xs">
                    <div>
                      <span className="font-semibold text-ink text-sm block">{log.medication_name} ({log.dosage})</span>
                      <span className="text-stone">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full font-mono text-[10px] uppercase font-bold ${
                        log.status === "taken"
                          ? "bg-teal-deep/10 text-teal-deep border border-teal-deep/20"
                          : "bg-clay-alert/10 text-clay-alert border border-clay-alert/20"
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="font-mono text-xs text-stone italic">No dose logs recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
