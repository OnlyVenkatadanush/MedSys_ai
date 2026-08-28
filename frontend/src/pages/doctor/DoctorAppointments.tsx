import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchDoctorAppointments, processAppointmentAction } from "@/services/clinicalService";
import type { AppointmentRecord } from "@/types";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Stethoscope,
  User,
  AlertCircle,
  FileText,
  Filter,
  Check,
  X,
  ChevronRight,
} from "lucide-react";

export const DoctorAppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"requested" | "confirmed" | "completed" | "cancelled">("requested");
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [declineModalId, setDeclineModalId] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    loadAppointments();
  }, [activeTab]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const res = await fetchDoctorAppointments(activeTab);
      setAppointments(res);
    } catch (err) {
      console.error("Failed to load doctor appointments", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id: string, action: "confirm" | "decline" | "complete" | "cancel") => {
    try {
      const note = actionNotes[id] || "";
      await processAppointmentAction(id, action, note);
      setDeclineModalId(null);
      await loadAppointments();
    } catch (err) {
      console.error("Failed to process appointment action", err);
    }
  };

  const pendingCount = appointments.filter((a) => a.status === "requested").length;

  return (
    <div className="space-y-8 pb-20">
      <PageHeader
        eyebrow="Clinical Schedule Management"
        title="Doctor Appointments Center"
        meta="Review, accept, or decline patient-submitted appointment requests and manage confirmed consultation schedules."
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* TAB CONTROLS */}
        <div className="flex items-center justify-between border-b border-hairline/80 pb-4 overflow-x-auto">
          <div className="flex items-center gap-2">
            {[
              { id: "requested", label: "Pending Approval", count: pendingCount },
              { id: "confirmed", label: "Confirmed Schedule" },
              { id: "completed", label: "Completed" },
              { id: "cancelled", label: "Cancelled" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-teal-deep text-white shadow-xs"
                    : "border border-hairline bg-surface-card text-stone hover:text-ink hover:bg-bg-mist"
                }`}
              >
                <span>{tab.label}</span>
                {tab.id === "requested" && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                      activeTab === "requested"
                        ? "bg-white/20 text-white"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                    }`}
                  >
                    {appointments.filter((a) => a.status === "requested").length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <span className="font-mono text-xs text-stone hidden sm:inline">
            Doctor Role: <span className="font-semibold text-ink">Review & Confirm Only</span>
          </span>
        </div>

        {/* APPOINTMENT LIST */}
        {loading ? (
          <div className="rounded-2xl border border-hairline bg-surface-card p-12 text-center font-mono text-xs text-stone">
            Loading appointment schedule…
          </div>
        ) : appointments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-hairline bg-surface-card p-12 text-center space-y-3">
            <Calendar className="mx-auto h-8 w-8 text-stone/50" />
            <p className="font-display text-base font-semibold text-ink">No {activeTab} appointments</p>
            <p className="text-xs text-stone max-w-sm mx-auto">
              {activeTab === "requested"
                ? "There are currently no pending appointment requests from patients awaiting confirmation."
                : `No appointments currently marked as ${activeTab}.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence>
              {appointments.map((appt) => {
                const isRequested = appt.status === "requested";
                const isConfirmed = appt.status === "confirmed";

                return (
                  <motion.div
                    key={appt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`relative rounded-2xl border bg-surface-card p-6 shadow-xs flex flex-col justify-between space-y-4 transition-all ${
                      isRequested
                        ? "border-amber-500/30 ring-1 ring-amber-500/10"
                        : isConfirmed
                        ? "border-teal-deep/30"
                        : "border-hairline"
                    }`}
                  >
                    <div>
                      {/* HEADER: PATIENT NAME & BADGE */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-deep/10 text-teal-deep font-bold font-mono">
                            {appt.patient_name.charAt(0)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-ink text-base">{appt.patient_name}</h3>
                            <span className="font-mono text-[11px] text-stone">ID: {appt.patient_id}</span>
                          </div>
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
                          {appt.status}
                        </span>
                      </div>

                      {/* DATE & TIME SLOT */}
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

                        <div className="flex items-start gap-2 text-xs text-stone">
                          <FileText className="h-4 w-4 shrink-0 text-stone/70 mt-0.5" />
                          <p className="leading-snug">
                            <span className="font-semibold text-ink">Reason: </span>
                            {appt.reason}
                          </p>
                        </div>

                        {appt.notes && (
                          <p className="text-[11px] italic text-stone pt-1 border-t border-hairline/40">
                            Doctor Notes: {appt.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* DOCTOR ACTION BUTTONS */}
                    <div className="pt-3 border-t border-hairline/60 flex items-center justify-between gap-3">
                      {isRequested && (
                        <div className="flex items-center gap-2 w-full">
                          <button
                            onClick={() => handleAction(appt.id, "confirm")}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 active:scale-95 transition-all"
                          >
                            <Check className="h-4 w-4" />
                            <span>Accept & Confirm</span>
                          </button>

                          <button
                            onClick={() => setDeclineModalId(appt.id)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-50/10 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 active:scale-95 transition-all"
                          >
                            <X className="h-4 w-4" />
                            <span>Decline Request</span>
                          </button>
                        </div>
                      )}

                      {isConfirmed && (
                        <div className="flex items-center gap-2 w-full">
                          <button
                            onClick={() => navigate(`/doctor/patient/${appt.patient_id}`)}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-teal-deep px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 active:scale-95 transition-all"
                          >
                            <Stethoscope className="h-4 w-4" />
                            <span>Start Consultation</span>
                          </button>

                          <button
                            onClick={() => handleAction(appt.id, "complete")}
                            className="flex items-center justify-center gap-1 rounded-xl border border-hairline bg-surface-card px-3.5 py-2 text-xs font-medium text-stone hover:text-ink hover:bg-bg-mist active:scale-95 transition-all"
                          >
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            <span>Mark Complete</span>
                          </button>
                        </div>
                      )}

                      {(appt.status === "completed" || appt.status === "cancelled") && (
                        <div className="w-full flex items-center justify-between text-xs text-stone font-mono">
                          <span>Status: {appt.status.toUpperCase()}</span>
                          <button
                            onClick={() => navigate(`/doctor/patient/${appt.patient_id}`)}
                            className="text-teal-deep font-semibold hover:underline flex items-center gap-1"
                          >
                            <span>Patient Record</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* DECLINE REASON MODAL */}
      {declineModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-semibold text-ink">Decline Appointment Request</h3>
            </div>
            <p className="text-xs text-stone leading-relaxed">
              Please provide a reason or alternative suggestion for the patient before declining this appointment request.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Doctor is unavailable at 10:00 AM. Please request a slot after 02:00 PM."
              className="w-full rounded-xl border border-hairline bg-bg-mist p-3 text-xs text-ink focus:border-teal-deep focus:outline-none"
              value={actionNotes[declineModalId] || ""}
              onChange={(e) => setActionNotes({ ...actionNotes, [declineModalId]: e.target.value })}
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeclineModalId(null)}
                className="rounded-full border border-hairline px-4 py-2 text-xs font-medium text-stone hover:bg-bg-mist transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction(declineModalId, "decline")}
                className="rounded-full bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-md hover:bg-rose-700 active:scale-95 transition-all"
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
