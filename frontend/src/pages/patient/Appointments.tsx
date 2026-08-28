import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchDoctorAvailability,
  requestPatientAppointment,
  fetchPatientAppointments,
} from "@/services/clinicalService";
import type { AppointmentRecord, DoctorAvailabilityData, TimeSlot } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Stethoscope,
  Send,
  UserCheck,
  Ban,
  Sparkles,
} from "lucide-react";

export const Appointments: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>("2026-09-05");
  const [availability, setAvailability] = useState<DoctorAvailabilityData | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [patientAppts, setPatientAppts] = useState<AppointmentRecord[]>([]);
  const [loadingAppts, setLoadingAppts] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"book" | "my_appts">("book");

  useEffect(() => {
    loadAvailability();
    loadPatientAppointments();
  }, [selectedDate]);

  const loadAvailability = async () => {
    try {
      const res = await fetchDoctorAvailability("doc_01", selectedDate);
      setAvailability(res);
      // Select first available slot by default if available
      const firstAvailable = res.slots.find((s) => s.status === "available");
      if (firstAvailable) setSelectedSlot(firstAvailable.time);
    } catch (err) {
      console.error("Failed to load doctor availability", err);
    }
  };

  const loadPatientAppointments = async () => {
    try {
      setLoadingAppts(true);
      const res = await fetchPatientAppointments();
      setPatientAppts(res);
    } catch (err) {
      console.error("Failed to load patient appointments", err);
    } finally {
      setLoadingAppts(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !reason.trim()) return;

    try {
      setSubmitting(true);
      const fullDateTime = `${selectedDate}T${selectedSlot}`;
      await requestPatientAppointment({
        doctor_id: "doc_01",
        appointment_date: fullDateTime,
        reason: reason.trim(),
        notes: notes.trim(),
      });

      setReason("");
      setNotes("");
      setSelectedSlot(null);
      await loadAvailability();
      await loadPatientAppointments();
      setActiveTab("my_appts");
    } catch (err) {
      console.error("Failed to submit appointment request", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <PageHeader
        eyebrow="Patient Care Scheduling"
        title="Book & Manage Appointments"
        meta="Check doctor availability slots, request new appointment consultations, and track approval status."
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* TABS */}
        <div className="flex items-center justify-between border-b border-hairline/80 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("book")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "book"
                  ? "bg-teal-deep text-white shadow-xs"
                  : "border border-hairline bg-surface-card text-stone hover:text-ink"
              }`}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Book Appointment</span>
            </button>

            <button
              onClick={() => setActiveTab("my_appts")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === "my_appts"
                  ? "bg-teal-deep text-white shadow-xs"
                  : "border border-hairline bg-surface-card text-stone hover:text-ink"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>My Requests & Bookings</span>
              {patientAppts.length > 0 && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[10px] text-white">
                  {patientAppts.length}
                </span>
              )}
            </button>
          </div>

          <span className="font-mono text-xs text-stone hidden sm:inline">
            Assigned Doctor: <span className="font-semibold text-ink">Dr. Sarah Smith, MD</span>
          </span>
        </div>

        {activeTab === "book" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* DOCTOR AVAILABILITY SCHEDULE (7 COLS) */}
            <div className="lg:col-span-7 rounded-2xl border border-hairline bg-surface-card p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-hairline/60 pb-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">1. Select Appointment Date & Slot</h2>
                  <p className="text-xs text-stone">Check real-time doctor availability and busy time slots</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-stone font-mono">
                    <span className="h-2.5 w-2.5 rounded-full bg-teal-deep" />
                    Available
                  </span>
                  <span className="flex items-center gap-1 text-xs text-stone font-mono">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    Busy
                  </span>
                </div>
              </div>

              {/* DATE PICKER & DOCTOR CARD */}
              <div className="flex flex-col sm:flex-row items-center gap-4 bg-bg-mist/50 p-4 rounded-xl border border-hairline/60">
                <div className="w-full sm:w-auto flex-1">
                  <label className="block font-mono text-[11px] uppercase tracking-wider text-stone mb-1">
                    Select Date
                  </label>
                  <input
                    type="date"
                    min="2026-08-28"
                    max="2026-10-31"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-surface-card px-3.5 py-2 text-xs font-semibold text-ink focus:border-teal-deep focus:outline-none"
                  />
                </div>

                <div className="w-full sm:w-auto flex items-center gap-3 bg-surface-card p-3 rounded-xl border border-hairline shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-deep/10 text-teal-deep font-bold font-mono">
                    SS
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink">Dr. Sarah Smith, MD</p>
                    <p className="text-[10px] text-stone">Cardiology & Internal Medicine</p>
                  </div>
                </div>
              </div>

              {/* TIME SLOTS GRID */}
              <div>
                <span className="block font-mono text-[11px] uppercase tracking-wider text-stone mb-3">
                  Available Time Slots ({selectedDate})
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {(availability?.slots || []).map((slot: TimeSlot, idx: number) => {
                    const isAvailable = slot.status === "available";
                    const isSelected = selectedSlot === slot.time;

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => setSelectedSlot(slot.time)}
                        className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all ${
                          !isAvailable
                            ? "border-hairline bg-bg-mist/80 text-stone opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "border-teal-deep bg-teal-deep text-white shadow-xs scale-[1.02]"
                            : "border-hairline bg-surface-card text-ink hover:border-teal-deep hover:bg-teal-deep/5"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Clock className={`h-4 w-4 ${isSelected ? "text-white" : isAvailable ? "text-teal-deep" : "text-stone"}`} />
                          <span className="font-mono text-xs font-semibold">{slot.time}</span>
                        </div>

                        {!isAvailable ? (
                          <span className="font-mono text-[10px] font-bold text-rose-500 uppercase flex items-center gap-1">
                            <Ban className="h-3 w-3" />
                            Busy
                          </span>
                        ) : isSelected ? (
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        ) : (
                          <span className="font-mono text-[10px] text-teal-deep font-semibold uppercase">Open</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* APPOINTMENT DETAILS FORM (5 COLS) */}
            <div className="lg:col-span-5 rounded-2xl border border-hairline bg-surface-card p-6 shadow-xs flex flex-col justify-between">
              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div className="border-b border-hairline/60 pb-3">
                  <h2 className="font-display text-base font-semibold text-ink">2. Reason & Intake Notes</h2>
                  <p className="text-xs text-stone">Submit request for doctor confirmation</p>
                </div>

                {/* SELECTED SLOT SUMMARY */}
                <div className="rounded-xl border border-teal-deep/30 bg-teal-deep/5 p-3.5 flex items-center justify-between">
                  <div>
                    <span className="block font-mono text-[10px] uppercase text-teal-deep font-semibold">Selected Slot</span>
                    <span className="font-mono text-xs font-bold text-ink">
                      {selectedDate} at {selectedSlot || "Select a slot"}
                    </span>
                  </div>
                  <CalendarIcon className="h-5 w-5 text-teal-deep" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">
                    Reason for Visit <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Routine blood pressure check & prescription renewal"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-xs text-ink focus:border-teal-deep focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink mb-1">Additional Symptoms / Doctor Notes</label>
                  <textarea
                    rows={4}
                    placeholder="e.g. Experiencing mild morning headache since last 3 days."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-xs text-ink focus:border-teal-deep focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !selectedSlot || !reason.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-teal-deep py-3 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <span>Submitting Request…</span>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Submit Appointment Request</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-stone text-center flex items-center justify-center gap-1 pt-1">
                  <UserCheck className="h-3.5 w-3.5 text-teal-deep" />
                  Doctor will receive request and confirm schedule
                </p>
              </form>
            </div>
          </div>
        ) : (
          /* MY APPOINTMENTS LIST TABS */
          <div className="space-y-4">
            {loadingAppts ? (
              <div className="rounded-2xl border border-hairline bg-surface-card p-12 text-center font-mono text-xs text-stone">
                Loading your appointments…
              </div>
            ) : patientAppts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-hairline bg-surface-card p-12 text-center space-y-3">
                <CalendarIcon className="mx-auto h-8 w-8 text-stone/50" />
                <p className="font-display text-base font-semibold text-ink">No Appointments Found</p>
                <p className="text-xs text-stone">You have not submitted any appointment requests yet.</p>
                <button
                  onClick={() => setActiveTab("book")}
                  className="rounded-full bg-teal-deep px-4 py-2 text-xs font-semibold text-white shadow-xs"
                >
                  Book New Appointment
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {patientAppts.map((appt) => {
                  const isRequested = appt.status === "requested";
                  const isConfirmed = appt.status === "confirmed";

                  return (
                    <div
                      key={appt.id}
                      className={`rounded-2xl border bg-surface-card p-6 shadow-xs space-y-4 transition-all ${
                        isRequested
                          ? "border-amber-500/30 ring-1 ring-amber-500/10"
                          : isConfirmed
                          ? "border-teal-deep/30"
                          : "border-hairline"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-ink text-base">{appt.doctor_name}</h3>
                          <p className="font-mono text-[11px] text-stone">Cardiology & Internal Medicine</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider ${
                            isRequested
                              ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                              : isConfirmed
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                              : appt.status === "completed"
                              ? "bg-teal-deep/10 text-teal-deep"
                              : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {isRequested ? "Pending Doctor Approval" : appt.status}
                        </span>
                      </div>

                      <div className="rounded-xl bg-bg-mist/60 p-3.5 space-y-2 border border-hairline/60">
                        <div className="flex items-center gap-2 text-xs font-semibold text-ink">
                          <Clock className="h-4 w-4 text-teal-deep" />
                          <span>
                            {new Date(appt.appointment_date || appt.date_time || Date.now()).toLocaleString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-stone">
                          <span className="font-semibold text-ink">Reason: </span>
                          {appt.reason}
                        </p>
                        {appt.notes && <p className="text-[11px] text-stone italic">Notes: {appt.notes}</p>}
                      </div>

                      <div className="text-[11px] text-stone font-mono flex items-center justify-between border-t border-hairline/40 pt-2">
                        <span>Submitted: {new Date(appt.created_at).toLocaleDateString()}</span>
                        {isRequested && <span className="text-amber-600 font-semibold">Doctor Reviewing</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
