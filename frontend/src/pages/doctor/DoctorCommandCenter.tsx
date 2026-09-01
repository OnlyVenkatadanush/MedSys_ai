import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { PageHeader } from "@/components/PageHeader";
import { fetchCommandCenter } from "@/services/clinicalService";
import type { CommandCenterData } from "@/types";
import {
  Users,
  Calendar,
  AlertTriangle,
  ArrowRight,
  Activity,
  Command,
  Zap,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";

export const DoctorCommandCenter: React.FC = () => {
  const { user } = useUser();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const doctorDisplayName =
    user?.fullName ||
    (user?.firstName ? `Dr. ${user.firstName} ${user.lastName || ""}`.trim() : "") ||
    "Dr. Clinician";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchCommandCenter();
      setData(res);
    } catch (err: any) {
      console.error("Failed to load Command Center", err);
      setError("Failed to connect to the backend clinical server.");
    } finally {
      setLoading(false);
    }
  };

  const priorityAlerts = data?.priority_queue || [];
  const todaysAppointments = data?.todays_appointments || [];

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Doctor Clinical Command Center"
        title={`Good Day, ${doctorDisplayName}`}
        meta={
          loading
            ? "Syncing real-time clinical priority queue from backend..."
            : `You have ${data?.todays_appointments_count || 0} appointment(s) scheduled and ${data?.active_alerts_count || 0} active triage alert(s).`
        }
      />

      <div className="px-5 sm:px-8 space-y-8">
        {/* Quick Command Palette Bar */}
        <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface-card p-3 shadow-xs font-mono text-xs text-stone">
          <div className="flex items-center gap-2">
            <Command className="h-4 w-4 text-teal-deep shrink-0" />
            <span>
              Press{" "}
              <kbd className="bg-bg-mist border border-hairline px-1.5 py-0.5 rounded font-bold text-ink">
                Ctrl + K
              </kbd>{" "}
              anywhere to search patients or launch clinical tools.
            </span>
          </div>
          <button
            onClick={() => navigate("/doctor/patients")}
            className="text-ink font-semibold hover:text-teal-deep flex items-center gap-1 shrink-0"
          >
            <span>View All Patients</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-clay-alert/30 bg-clay-alert/5 p-4 font-mono text-xs text-clay-alert flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* DOMINANT SECTION 1: ⚡ NEEDS YOUR ATTENTION TODAY (PRIORITY QUEUE) */}
        <div className="rounded-2xl border-2 border-clay-alert/30 bg-surface-card p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2.5">
              <Zap className="h-5 w-5 text-clay-alert animate-bounce shrink-0" />
              <h2 className="font-display text-xl tracking-tight text-ink font-semibold">
                ⚡ NEEDS YOUR ATTENTION TODAY
              </h2>
            </div>
            <span className="font-mono text-xs text-clay-alert font-bold">
              {loading
                ? "Loading queue..."
                : `${priorityAlerts.length} Patient(s) Require Review`}
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-hairline bg-bg-mist p-4 space-y-3 animate-pulse h-36"
                />
              ))}
            </div>
          ) : priorityAlerts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hairline bg-bg-mist/50 p-6 text-center space-y-2">
              <CheckCircle2 className="h-6 w-6 text-teal-deep mx-auto" />
              <p className="font-display text-base font-semibold text-ink">
                No Urgent Triage Alerts
              </p>
              <p className="font-mono text-xs text-stone">
                All patient panels are currently stable. No critical lab or adherence flags pending.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {priorityAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-xl border p-4 space-y-3 flex flex-col justify-between ${
                    alert.severity === "critical"
                      ? "bg-clay-alert/5 border-clay-alert/30"
                      : "bg-bg-mist border-hairline"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-semibold text-ink text-base truncate">
                        {alert.patient_name}
                      </span>
                      <span
                        className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          alert.severity === "critical"
                            ? "bg-clay-alert text-bg-mist"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {alert.type}
                      </span>
                    </div>
                    <p className="text-xs text-stone font-medium">{alert.title}</p>
                    <p className="font-mono text-[11px] text-ink">{alert.message}</p>
                  </div>

                  <button
                    onClick={() => navigate(`/doctor/patient/${alert.patient_id}`)}
                    className="w-full rounded-lg bg-ink py-2 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity flex items-center justify-center gap-1 mt-2"
                  >
                    <span>[Review Patient]</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4 Counter Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <div className="flex items-center justify-between text-stone">
              <span className="font-mono text-xs uppercase tracking-wider">Patients</span>
              <Users className="h-4 w-4 text-teal-deep shrink-0" />
            </div>
            <p className="font-display text-3xl font-bold text-ink">
              {loading ? "—" : data?.total_patients ?? 0}
            </p>
            <span className="font-mono text-[10px] text-teal-deep">Active Panel</span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <div className="flex items-center justify-between text-stone">
              <span className="font-mono text-xs uppercase tracking-wider">Appts Today</span>
              <Calendar className="h-4 w-4 text-indigo-thread shrink-0" />
            </div>
            <p className="font-display text-3xl font-bold text-ink">
              {loading ? "—" : data?.todays_appointments_count ?? 0}
            </p>
            <span className="font-mono text-[10px] text-stone">Scheduled Visits</span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <div className="flex items-center justify-between text-stone">
              <span className="font-mono text-xs uppercase tracking-wider">Labs</span>
              <Activity className="h-4 w-4 text-teal-deep shrink-0" />
            </div>
            <p className="font-display text-3xl font-bold text-ink">
              {loading ? "—" : data?.pending_labs_count ?? 0}
            </p>
            <span className="font-mono text-[10px] text-clay-alert font-semibold">
              {data?.pending_labs_count ? `${data.pending_labs_count} Pending Review` : "All Reviewed"}
            </span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <div className="flex items-center justify-between text-stone">
              <span className="font-mono text-xs uppercase tracking-wider">Alerts</span>
              <AlertTriangle className="h-4 w-4 text-clay-alert shrink-0" />
            </div>
            <p className="font-display text-3xl font-bold text-clay-alert">
              {loading ? "—" : data?.active_alerts_count ?? 0}
            </p>
            <span className="font-mono text-[10px] text-clay-alert font-semibold">
              Priority Triage
            </span>
          </div>
        </div>

        {/* Today's Appointments List */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <h2 className="font-display text-lg tracking-tight text-ink font-semibold">
              Today's Scheduled Appointments
            </h2>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-teal-deep font-semibold">
                {loading
                  ? "Loading..."
                  : `${todaysAppointments.length} Scheduled Visit(s)`}
              </span>
              <button
                onClick={() => navigate("/doctor/appointments")}
                className="font-mono text-xs text-stone hover:text-ink flex items-center gap-1"
              >
                <span>Full Schedule</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-hairline bg-bg-mist p-4 h-16 animate-pulse"
                />
              ))}
            </div>
          ) : todaysAppointments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-hairline bg-bg-mist/50 p-6 text-center space-y-2">
              <Clock className="h-5 w-5 text-stone mx-auto" />
              <p className="font-display text-sm font-medium text-stone">
                No appointments scheduled for today.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {todaysAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="rounded-xl border border-hairline bg-bg-mist p-4 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-deep">
                        {new Date(
                          apt.date_time || apt.appointment_date || Date.now()
                        ).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="font-display font-semibold text-ink text-base">
                        {apt.patient_name}
                      </span>
                    </div>
                    <p className="text-xs text-stone">{apt.reason}</p>
                  </div>

                  <button
                    onClick={() => navigate(`/doctor/patient/${apt.patient_id}`)}
                    className="rounded-lg border border-hairline bg-surface-card px-4 py-2 text-xs font-mono text-ink hover:bg-bg-mist transition-colors shrink-0"
                  >
                    Open Workspace
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
