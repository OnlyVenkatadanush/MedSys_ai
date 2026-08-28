import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { fetchCommandCenter } from "@/services/clinicalService";
import type { CommandCenterData } from "@/types";
import { Stethoscope, Users, Calendar, AlertTriangle, ArrowRight, Activity, Command, Zap } from "lucide-react";

export const DoctorCommandCenter: React.FC = () => {
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchCommandCenter();
      setData(res);
    } catch (err) {
      console.error("Failed to load Command Center", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Doctor Clinical Command Center"
        title="Good Afternoon, Dr. Smith"
        meta="You have 8 appointments scheduled today. Here is your priority attention queue."
      />

      <div className="px-5 sm:px-8 space-y-8">
        {/* Quick Command Palette Bar */}
        <div className="flex items-center justify-between rounded-xl border border-hairline bg-surface-card p-3 shadow-xs font-mono text-xs text-stone">
          <div className="flex items-center gap-2">
            <Command className="h-4 w-4 text-teal-deep" />
            <span>Press <kbd className="bg-bg-mist border border-hairline px-1.5 py-0.5 rounded font-bold text-ink">Ctrl + K</kbd> anywhere to search patients or launch tools.</span>
          </div>
          <button
            onClick={() => navigate("/doctor/patients")}
            className="text-ink font-semibold hover:text-teal-deep flex items-center gap-1"
          >
            <span>View All Patients</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* DOMINANT SECTION 1: ⚡ NEEDS YOUR ATTENTION TODAY (PRIORITY QUEUE) */}
        <div className="rounded-2xl border-2 border-clay-alert/30 bg-surface-card p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div className="flex items-center gap-2.5">
              <Zap className="h-5 w-5 text-clay-alert animate-bounce" />
              <h2 className="font-display text-xl tracking-tight text-ink font-semibold">
                ⚡ NEEDS YOUR ATTENTION TODAY
              </h2>
            </div>
            <span className="font-mono text-xs text-clay-alert font-bold">
              {data?.priority_queue.length || 3} Patients Require Review
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(data?.priority_queue || []).map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 space-y-3 flex flex-col justify-between ${
                  alert.severity === "critical"
                    ? "bg-clay-alert/5 border-clay-alert/30"
                    : "bg-bg-mist border-hairline"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-display font-semibold text-ink text-base">{alert.patient_name}</span>
                    <span
                      className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
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
        </div>

        {/* 4 Counter Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <div className="flex items-center justify-between text-stone">
              <span className="font-mono text-xs uppercase tracking-wider">Patients</span>
              <Users className="h-4 w-4 text-teal-deep" />
            </div>
            <p className="font-display text-3xl font-bold text-ink">{data?.total_patients || 124}</p>
            <span className="font-mono text-[10px] text-teal-deep">Active Panel</span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <div className="flex items-center justify-between text-stone">
              <span className="font-mono text-xs uppercase tracking-wider">Appts Today</span>
              <Calendar className="h-4 w-4 text-indigo-thread" />
            </div>
            <p className="font-display text-3xl font-bold text-ink">{data?.todays_appointments_count || 8}</p>
            <span className="font-mono text-[10px] text-stone">Scheduled Visits</span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <div className="flex items-center justify-between text-stone">
              <span className="font-mono text-xs uppercase tracking-wider">Labs</span>
              <Activity className="h-4 w-4 text-teal-deep" />
            </div>
            <p className="font-display text-3xl font-bold text-ink">{data?.pending_labs_count || 4}</p>
            <span className="font-mono text-[10px] text-clay-alert font-semibold">4 Pending Review</span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <div className="flex items-center justify-between text-stone">
              <span className="font-mono text-xs uppercase tracking-wider">Alerts</span>
              <AlertTriangle className="h-4 w-4 text-clay-alert" />
            </div>
            <p className="font-display text-3xl font-bold text-clay-alert">{data?.active_alerts_count || 3}</p>
            <span className="font-mono text-[10px] text-clay-alert font-semibold">Priority Triage</span>
          </div>
        </div>

        {/* Today's Appointments List */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <h2 className="font-display text-lg tracking-tight text-ink font-semibold">
              Today's Scheduled Appointments
            </h2>
            <span className="font-mono text-xs text-teal-deep font-semibold">
              {data?.todays_appointments.length || 2} Scheduled Visits
            </span>
          </div>

          <div className="space-y-3">
            {(data?.todays_appointments || []).map((apt) => (
              <div
                key={apt.id}
                className="rounded-xl border border-hairline bg-bg-mist p-4 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-teal-deep">
                      {new Date(apt.date_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="font-display font-semibold text-ink text-base">{apt.patient_name}</span>
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
        </div>
      </div>
    </div>
  );
};
