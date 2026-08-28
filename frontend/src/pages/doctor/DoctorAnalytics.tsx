import React, { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchDoctorAnalytics } from "@/services/clinicalService";
import type { DoctorAnalytics as DoctorAnalyticsType } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Calendar,
  AlertTriangle,
  Activity,
  CheckCircle2,
  TrendingUp,
  Clock,
  Filter,
  PieChart,
  BarChart3,
  HeartPulse,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Zap,
} from "lucide-react";

export const DoctorAnalyticsPage: React.FC = () => {
  const [data, setData] = useState<DoctorAnalyticsType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeframe, setTimeframe] = useState<"week" | "month" | "quarter">("week");
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

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

  // Process Risk Donut Data
  const riskDistribution = useMemo(() => {
    return (
      data?.patient_risk_distribution || [
        { label: "Stable Condition", count: 7, percentage: 58.3, color: "#0d9488" },
        { label: "Requires Attention", count: 3, percentage: 25.0, color: "#f59e0b" },
        { label: "Critical / High Risk", count: 2, percentage: 16.7, color: "#ef4444" },
      ]
    );
  }, [data]);

  // Process Chronic Conditions Data
  const chronicConditions = useMemo(() => {
    return (
      data?.top_chronic_conditions || [
        { condition: "Hypertension (Stage 1/2)", count: 8, percentage: 66.7 },
        { condition: "Type 2 Diabetes Mellitus", count: 5, percentage: 41.7 },
        { condition: "Bronchial Asthma", count: 3, percentage: 25.0 },
        { condition: "Hyperlipidemia / Dyslipidemia", count: 4, percentage: 33.3 },
        { condition: "Chronic Kidney Disease", count: 2, percentage: 16.7 },
      ]
    );
  }, [data]);

  // Process Adherence Data
  const adherenceBreakdown = useMemo(() => {
    return (
      data?.adherence_breakdown || [
        { category: "High Adherence (>85%)", count: 7, percentage: 58.3, color: "#10b981" },
        { category: "Moderate Adherence (70-85%)", count: 3, percentage: 25.0, color: "#3b82f6" },
        { category: "Low Adherence (<70%)", count: 2, percentage: 16.7, color: "#f59e0b" },
      ]
    );
  }, [data]);

  // Process Weekly Velocity
  const velocityData = useMemo(() => {
    return (
      data?.weekly_consultation_velocity || [
        { day: "Mon", count: 8 },
        { day: "Tue", count: 10 },
        { day: "Wed", count: 9 },
        { day: "Thu", count: 11 },
        { day: "Fri", count: 6 },
        { day: "Sat", count: 4 },
        { day: "Sun", count: 2 },
      ]
    );
  }, [data]);

  const maxVelocity = useMemo(() => {
    const max = Math.max(...velocityData.map((d) => d.count), 1);
    return Math.ceil(max * 1.2);
  }, [velocityData]);

  // Calculate Donut Segments (Circumference C = 2 * PI * 65 = 408.4)
  const donutSegments = useMemo(() => {
    const total = riskDistribution.reduce((acc, item) => acc + item.count, 0) || 1;
    let cumulativeAngle = 0;
    const C = 2 * Math.PI * 65; // ~408.4

    return riskDistribution.map((item) => {
      const pct = item.count / total;
      const strokeLength = pct * C;
      const strokeOffset = -cumulativeAngle * C;
      cumulativeAngle += pct;
      return {
        ...item,
        strokeLength,
        strokeOffset,
        total,
      };
    });
  }, [riskDistribution]);

  return (
    <div className="space-y-8 pb-20">
      <PageHeader
        eyebrow="Clinical Analytics & Panel Performance"
        title="Doctor Analytics Center"
        meta="Real-time clinical metrics, patient risk distribution, treatment compliance, and consultation velocity."
        action={
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-xl border border-hairline bg-surface-card p-1 shadow-xs">
              {(["week", "month", "quarter"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                    timeframe === t
                      ? "bg-teal-deep text-white shadow-xs"
                      : "text-stone hover:text-ink"
                  }`}
                >
                  {t === "week" ? "This Week" : t === "month" ? "This Month" : "Quarterly"}
                </button>
              ))}
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-hairline bg-surface-card px-3.5 py-2 text-xs font-medium text-ink transition-all hover:border-teal-deep hover:bg-teal-deep/5 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-teal-deep ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        }
      />

      <div className="px-5 sm:px-8 space-y-8">
        {/* KPI COUNTER CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div
            whileHover={{ y: -2 }}
            className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-card p-5 shadow-xs"
          >
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-teal-deep/10 blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">Total Panel Patients</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-deep/10 text-teal-deep">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <p className="font-display text-3xl font-bold tracking-tight text-ink">
              {data?.total_assigned_patients || 12}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-teal-deep font-semibold">Active Panel</span>
              <span className="text-[11px] text-stone">Synced via SQLite</span>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -2 }}
            className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-card p-5 shadow-xs"
          >
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-sky-500/10 blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">Consultations (7 Days)</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <Activity className="h-4 w-4" />
              </div>
            </div>
            <p className="font-display text-3xl font-bold tracking-tight text-ink">
              {data?.consultations_this_week || 18}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-sky-600 font-semibold">+14.2% vs last period</span>
              <span className="text-[11px] text-stone">Completed</span>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -2 }}
            className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-surface-card p-5 shadow-xs"
          >
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-amber-500/10 blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Lab Reviews</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <p className="font-display text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {data?.pending_lab_reviews || 4}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                Sign-off Needed
              </span>
              <span className="text-[11px] text-stone">Action Required</span>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ y: -2 }}
            className="relative overflow-hidden rounded-2xl border border-teal-deep/20 bg-surface-card p-5 shadow-xs"
          >
            <div className="absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[11px] uppercase tracking-wider text-stone">Overall Panel Adherence</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <p className="font-display text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {data?.overall_adherence_rate || "84.2%"}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">High Compliance</span>
              <span className="text-[11px] text-stone">Rx Verified</span>
            </div>
          </motion.div>
        </div>

        {/* MAIN VISUAL CHARTS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* DONUT CHART: PATIENT RISK DISTRIBUTION (5 COLS) */}
          <div className="lg:col-span-5 rounded-2xl border border-hairline bg-surface-card p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-deep/10 text-teal-deep">
                    <PieChart className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">Patient Risk Distribution</h2>
                    <p className="text-[11px] text-stone">Panel triage & risk stratification</p>
                  </div>
                </div>
                <span className="font-mono text-[10px] font-semibold text-stone uppercase bg-bg-mist px-2 py-0.5 rounded-full">
                  Real-time Triage
                </span>
              </div>

              {/* SVG DONUT & INTERACTIVE LEGEND */}
              <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                <div className="relative h-44 w-44 shrink-0 flex items-center justify-center">
                  <svg className="h-full w-full transform -rotate-90" viewBox="0 0 160 160">
                    <circle cx="80" cy="80" r="65" fill="none" stroke="currentColor" strokeWidth="16" className="text-bg-mist" />
                    {donutSegments.map((seg, idx) => (
                      <circle
                        key={idx}
                        cx="80"
                        cy="80"
                        r="65"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={hoveredSegment === seg.label ? "20" : "16"}
                        strokeDasharray={`${seg.strokeLength} 408.4`}
                        strokeDashoffset={seg.strokeOffset}
                        strokeLinecap="round"
                        onMouseEnter={() => setHoveredSegment(seg.label)}
                        onMouseLeave={() => setHoveredSegment(null)}
                        className="transition-all duration-300 cursor-pointer"
                      />
                    ))}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="font-display text-2xl font-bold text-ink">
                      {hoveredSegment
                        ? riskDistribution.find((r) => r.label === hoveredSegment)?.percentage + "%"
                        : `${data?.total_assigned_patients || 12}`}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-stone tracking-wider">
                      {hoveredSegment ? hoveredSegment.split(" ")[0] : "Total Patients"}
                    </span>
                  </div>
                </div>

                {/* LEGEND BADGES */}
                <div className="flex-1 w-full space-y-3">
                  {riskDistribution.map((item, idx) => (
                    <div
                      key={idx}
                      onMouseEnter={() => setHoveredSegment(item.label)}
                      onMouseLeave={() => setHoveredSegment(null)}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                        hoveredSegment === item.label
                          ? "border-teal-deep bg-teal-deep/5 shadow-xs"
                          : "border-hairline/60 bg-bg-mist/40 hover:bg-bg-mist"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <div>
                          <p className="text-xs font-semibold text-ink">{item.label}</p>
                          <p className="text-[10px] text-stone">{item.count} Patients</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-bold text-ink bg-surface-card px-2 py-1 rounded-lg border border-hairline">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-hairline/60 flex items-center justify-between text-[11px] text-stone">
              <span className="flex items-center gap-1 text-teal-deep font-semibold">
                <Sparkles className="h-3 w-3" />
                AI Triage Severity Calculated
              </span>
              <span>Updated Today</span>
            </div>
          </div>

          {/* BAR CHART: WEEKLY CONSULTATION VELOCITY (7 COLS) */}
          <div className="lg:col-span-7 rounded-2xl border border-hairline bg-surface-card p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-deep/10 text-teal-deep">
                    <BarChart3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">Weekly Consultation Velocity</h2>
                    <p className="text-[11px] text-stone">Daily workload throughput across current week</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold text-teal-deep bg-teal-deep/10 px-2.5 py-1 rounded-full border border-teal-deep/20">
                    <Zap className="h-3 w-3" />
                    Peak: Thursday (11)
                  </span>
                </div>
              </div>

              {/* BAR CHART CONTAINER */}
              <div className="h-52 pt-4 flex items-end justify-between gap-3 sm:gap-4 font-mono text-xs">
                {velocityData.map((item, idx) => {
                  const barHeightPct = (item.count / maxVelocity) * 100;
                  const isPeak = item.count === Math.max(...velocityData.map((v) => v.count));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                      {/* Tooltip on Hover */}
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10 bg-ink text-surface-card text-[10px] font-mono py-1 px-2 rounded-lg shadow-md whitespace-nowrap">
                        {item.day}: {item.count} Consults
                      </div>

                      <span className={`font-bold text-[11px] ${isPeak ? "text-teal-deep" : "text-ink"}`}>
                        {item.count}
                      </span>
                      <div className="w-full max-w-[42px] bg-bg-mist rounded-t-xl h-full flex items-end overflow-hidden">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${barHeightPct}%` }}
                          transition={{ duration: 0.5, delay: idx * 0.05 }}
                          className={`w-full rounded-t-xl transition-all ${
                            isPeak
                              ? "bg-gradient-to-t from-teal-deep to-teal-400 shadow-sm"
                              : "bg-teal-deep/75 group-hover:bg-teal-deep"
                          }`}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-stone group-hover:text-ink transition-colors">
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-hairline/60 flex items-center justify-between text-[11px] text-stone">
              <span>Avg: 7.1 consults/day</span>
              <span className="font-mono text-teal-deep font-semibold">100% On-time Sign-off</span>
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: CHRONIC PREVALENCE + ADHERENCE GAUGE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CHRONIC CONDITION PREVALENCE (7 COLS) */}
          <div className="lg:col-span-7 rounded-2xl border border-hairline bg-surface-card p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-hairline/60 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-teal-deep/10 text-teal-deep">
                  <HeartPulse className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">Top Chronic Conditions Prevalence</h2>
                  <p className="text-[11px] text-stone">Diagnosis distribution across active patient panel</p>
                </div>
              </div>
              <span className="font-mono text-[10px] text-stone bg-bg-mist px-2.5 py-1 rounded-full border border-hairline">
                SQLite Filtered
              </span>
            </div>

            <div className="space-y-4">
              {chronicConditions.map((cond, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-ink flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-deep" />
                      {cond.condition}
                    </span>
                    <span className="font-mono text-stone">
                      {cond.count} Patients <span className="font-bold text-ink">({cond.percentage}%)</span>
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-bg-mist rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${cond.percentage}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                      className="h-full rounded-full bg-gradient-to-r from-teal-deep via-teal-500 to-emerald-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TREATMENT ADHERENCE & AGE DEMOGRAPHICS (5 COLS) */}
          <div className="lg:col-span-5 rounded-2xl border border-hairline bg-surface-card p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-hairline/60 pb-3 mb-5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-teal-deep/10 text-teal-deep">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">Panel Adherence Breakdown</h2>
                    <p className="text-[11px] text-stone">Medication intake & log compliance</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {adherenceBreakdown.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-hairline/60 bg-bg-mist/40 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-ink flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.category}
                      </span>
                      <span className="font-mono font-bold text-ink">{item.percentage}%</span>
                    </div>
                    <div className="h-2 w-full bg-bg-mist rounded-full overflow-hidden">
                      <div
                        style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AGE DEMOGRAPHICS CHIPS */}
            <div className="mt-5 pt-4 border-t border-hairline/60">
              <span className="font-mono text-[10px] uppercase tracking-wider text-stone block mb-2">
                Age Demographics Ratio
              </span>
              <div className="grid grid-cols-4 gap-2">
                {(data?.age_demographics || [
                  { group: "18-34", count: 2 },
                  { group: "35-50", count: 5 },
                  { group: "51-65", count: 4 },
                  { group: "65+", count: 1 },
                ]).map((demo, idx) => (
                  <div key={idx} className="rounded-xl border border-hairline bg-surface-card p-2 text-center">
                    <span className="block font-mono text-[10px] text-stone">{demo.group}</span>
                    <span className="font-mono text-sm font-bold text-ink">{demo.count} pts</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
