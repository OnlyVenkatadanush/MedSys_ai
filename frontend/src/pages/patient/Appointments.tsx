import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchAppointments, requestAppointment } from "@/services/clinicalService";
import type { AppointmentRecord } from "@/types";

export const Appointments: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [dateTime, setDateTime] = useState<string>("2026-09-10T10:00");
  const [reason, setReason] = useState<string>("Routine Hypertension & Medication Follow-up");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await fetchAppointments();
      setAppointments(data);
    } catch (err) {
      console.error("Failed to load appointments", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await requestAppointment({
        doctor_id: "doc_01",
        date_time: dateTime,
        reason,
      });
      loadAppointments();
    } catch (err) {
      console.error("Failed to request appointment", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Clinical Appointments"
        title="Appointment Manager"
        meta="Schedule follow-up sessions with your attending doctor and view appointment status."
      />

      <div className="px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Request Appointment Form */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
          <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
            Request Appointment
          </h2>
          <form onSubmit={handleRequest} className="space-y-4">
            <div>
              <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Select Doctor:</label>
              <select className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep">
                <option value="doc_01">Dr. Sarah Smith, MD (Cardiology / Internal Medicine)</option>
              </select>
            </div>

            <div>
              <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Preferred Date & Time:</label>
              <input
                type="datetime-local"
                required
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm font-mono text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
              />
            </div>

            <div>
              <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">Reason for Visit:</label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-bg-mist hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? "Booking..." : "Submit Appointment Request"}
            </button>
          </form>
        </div>

        {/* Upcoming Appointments List */}
        <div className="lg:col-span-2 rounded-2xl border border-hairline bg-surface-card p-6 space-y-4">
          <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
            Scheduled Appointments ({appointments.length})
          </h2>

          {loading ? (
            <div className="py-8 text-center font-mono text-xs text-stone">Loading appointments...</div>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div key={apt.id} className="rounded-xl border border-hairline bg-bg-mist p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="font-display text-base text-ink font-semibold block">{apt.doctor_name}</span>
                    <p className="text-xs text-stone">{apt.reason}</p>
                    <span className="font-mono text-xs text-teal-deep block">
                      📅 {new Date(apt.date_time).toLocaleString()}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full font-mono text-[10px] uppercase font-bold self-start sm:self-center ${
                      apt.status === "confirmed"
                        ? "bg-teal-deep/10 text-teal-deep border border-teal-deep/20"
                        : "bg-clay-alert/10 text-clay-alert border border-clay-alert/20"
                    }`}
                  >
                    {apt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
