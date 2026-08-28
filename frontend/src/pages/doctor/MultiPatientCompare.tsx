import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchMultiPatientCompare } from "@/services/clinicalService";
import type { MultiPatientCompareResult } from "@/types";
import { Sparkles, Users, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export const MultiPatientComparePage: React.FC = () => {
  const [data, setData] = useState<MultiPatientCompareResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetchMultiPatientCompare();
      setData(res);
    } catch (err) {
      console.error("Failed to load multi-patient comparison", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Clinical Panel Intelligence"
        title="Multi-Patient Comparison"
        meta="Side-by-side comparative analysis of patient vitals, lab metrics, and adherence rates."
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* AI Comparison Summary Banner */}
        <div className="rounded-2xl border border-teal-deep/30 bg-teal-deep/5 p-6 font-mono text-xs space-y-2">
          <div className="flex items-center gap-2 text-teal-deep font-bold">
            <Sparkles className="h-4 w-4" />
            <span>🤖 AI Comparative Panel Summary:</span>
          </div>
          <p className="text-ink leading-relaxed font-sans font-medium">{data?.comparison_summary}</p>
        </div>

        {/* Side-by-Side Patient Cards Table */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(data?.patients || []).map((patient) => (
            <div
              key={patient.patient_id}
              className={`rounded-2xl border p-6 flex flex-col justify-between space-y-4 shadow-xs ${
                patient.status === "attention"
                  ? "bg-clay-alert/5 border-clay-alert/30"
                  : "bg-surface-card border-hairline"
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-hairline pb-3">
                  <div>
                    <h2 className="font-display text-lg tracking-tight text-ink font-semibold">{patient.name}</h2>
                    <span className="font-mono text-xs text-stone">ID: {patient.patient_id} • Age {patient.age}</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                      patient.status === "attention"
                        ? "bg-clay-alert text-bg-mist"
                        : "bg-teal-deep/10 text-teal-deep"
                    }`}
                  >
                    {patient.status}
                  </span>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <div className="flex justify-between p-2 rounded-lg bg-bg-mist">
                    <span className="text-stone">Primary Diagnosis:</span>
                    <span className="font-semibold text-ink text-right">{patient.primary_diagnosis}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-bg-mist">
                    <span className="text-stone">Adherence Rate:</span>
                    <span className={`font-bold ${patient.status === "attention" ? "text-clay-alert" : "text-teal-deep"}`}>
                      {patient.adherence_rate}
                    </span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-bg-mist">
                    <span className="text-stone">Latest BP:</span>
                    <span className="font-semibold text-ink">{patient.latest_bp}</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-bg-mist">
                    <span className="text-stone">Latest Fasting Glucose:</span>
                    <span className="font-semibold text-ink">{patient.latest_glucose}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => navigate(`/doctor/patient/${patient.patient_id}`)}
                className="w-full rounded-lg bg-ink py-2 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity flex items-center justify-center gap-1 mt-2"
              >
                <span>Open Workspace</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
