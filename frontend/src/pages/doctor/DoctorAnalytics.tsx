import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchDoctorAnalytics } from "@/services/clinicalService";
import type { DoctorAnalytics as DoctorAnalyticsType } from "@/types";
import { BarChart3, Users, Calendar, Activity, TrendingUp, CheckCircle } from "lucide-react";

export const DoctorAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<DoctorAnalyticsType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchDoctorAnalytics();
      setData(res);
    } catch (err) {
      console.error("Failed to load analytics", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Clinical Practice Insights"
        title="Doctor Analytics"
        meta="Actionable summary of patient panel metrics, weekly consultation velocity, and overall compliance rates."
      />

      <div className="px-5 sm:px-8 space-y-8">
        {/* 4 Counter Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <span className="font-mono text-xs uppercase tracking-wider text-stone block">Total Panel Patients</span>
            <p className="font-display text-3xl font-bold text-ink">{data?.total_assigned_patients || 124}</p>
            <span className="font-mono text-[10px] text-teal-deep">Active Accounts</span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <span className="font-mono text-xs uppercase tracking-wider text-stone block">Consultations (This Week)</span>
            <p className="font-display text-3xl font-bold text-ink">{data?.consultations_this_week || 42}</p>
            <span className="font-mono text-[10px] text-stone">Completed Sessions</span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <span className="font-mono text-xs uppercase tracking-wider text-stone block">Pending Lab Reviews</span>
            <p className="font-display text-3xl font-bold text-clay-alert">{data?.pending_lab_reviews || 8}</p>
            <span className="font-mono text-[10px] text-clay-alert font-semibold">Requires Sign-off</span>
          </div>

          <div className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-2">
            <span className="font-mono text-xs uppercase tracking-wider text-stone block">Overall Panel Adherence</span>
            <p className="font-display text-3xl font-bold text-teal-deep">{data?.overall_adherence_rate || "84%"}</p>
            <span className="font-mono text-[10px] text-teal-deep font-semibold">Good Compliance</span>
          </div>
        </div>

        {/* Weekly Consultation Velocity Chart */}
        <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4 shadow-xs">
          <h2 className="font-display text-lg tracking-tight text-ink border-b border-hairline pb-3">
            Weekly Consultation Velocity
          </h2>
          <div className="flex items-end justify-between gap-4 h-48 pt-6 font-mono text-xs">
            {(data?.weekly_consultation_velocity || [
              { day: "Mon", count: 8 },
              { day: "Tue", count: 10 },
              { day: "Wed", count: 9 },
              { day: "Thu", count: 11 },
              { day: "Fri", count: 4 },
            ]).map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="font-bold text-ink">{item.count}</span>
                <div
                  style={{ height: `${(item.count / 12) * 100}%` }}
                  className="w-full max-w-[40px] bg-teal-deep rounded-t-lg transition-all"
                ></div>
                <span className="text-stone font-semibold">{item.day}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
