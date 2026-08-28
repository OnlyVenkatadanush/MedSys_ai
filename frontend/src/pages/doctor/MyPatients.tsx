import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { searchPatients } from "@/services/clinicalService";
import type { DoctorPatientAssignment } from "@/types";
import { Search, User, Stethoscope, MessageSquare, Clock, ArrowRight } from "lucide-react";

export const MyPatients: React.FC = () => {
  const [patients, setPatients] = useState<DoctorPatientAssignment[]>([]);
  const [query, setQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  useEffect(() => {
    handleSearch("");
  }, []);

  const handleSearch = async (searchTerm: string) => {
    try {
      setLoading(true);
      const res = await searchPatients(searchTerm);
      setPatients(res);
    } catch (err) {
      console.error("Failed to search patients", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Clinical Panel Directory"
        title="My Patients"
        meta="Search and access assigned patient workspaces, clinical timelines, and AI copilot tools."
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* Search Bar */}
        <div className="relative rounded-2xl border border-hairline bg-surface-card p-2 shadow-xs">
          <Search className="absolute left-5 top-4.5 h-5 w-5 text-stone" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              handleSearch(e.target.value);
            }}
            placeholder="Search patient by name, Patient ID (e.g. pat_01), or phone..."
            className="w-full bg-bg-mist border border-hairline rounded-xl pl-12 pr-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
          />
        </div>

        {/* Patient Cards Grid */}
        {loading ? (
          <div className="py-12 text-center font-mono text-sm text-stone">Loading assigned patients...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {patients.map((patient) => {
              const isAttention = patient.patient_id === "pat_03";
              return (
                <div
                  key={patient.id}
                  className="rounded-2xl border border-hairline bg-surface-card p-6 flex flex-col justify-between space-y-6 shadow-xs hover:border-ink transition-all"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-ink text-bg-mist flex items-center justify-center font-bold text-sm">
                          {patient.patient_name.charAt(0)}
                        </div>
                        <div>
                          <h2 className="font-display text-lg tracking-tight text-ink font-semibold">
                            {patient.patient_name}
                          </h2>
                          <span className="font-mono text-xs text-stone">
                            {patient.patient_age} yrs • {patient.patient_gender || "Male"} • ID: {patient.patient_id}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`font-mono text-[10px] uppercase font-bold px-2.5 py-1 rounded-full ${
                          isAttention
                            ? "bg-clay-alert/10 text-clay-alert border border-clay-alert/20"
                            : "bg-teal-deep/10 text-teal-deep border border-teal-deep/20"
                        }`}
                      >
                        {isAttention ? "🟠 Attention" : "🟢 Active"}
                      </span>
                    </div>
                  </div>

                  {/* 4 Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-hairline">
                    <button
                      onClick={() => navigate(`/doctor/patient/${patient.patient_id}`)}
                      className="rounded-lg bg-ink py-2 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity"
                    >
                      Workspace
                    </button>
                    <button
                      onClick={() => navigate(`/doctor/patient/${patient.patient_id}?tab=consultations`)}
                      className="rounded-lg border border-hairline bg-bg-mist py-2 text-xs font-mono text-ink hover:bg-surface-card transition-colors"
                    >
                      Consultation
                    </button>
                    <button
                      onClick={() => navigate(`/doctor/patient/${patient.patient_id}?tab=copilot`)}
                      className="rounded-lg border border-hairline bg-bg-mist py-2 text-xs font-mono text-ink hover:bg-surface-card transition-colors"
                    >
                      Ask AI
                    </button>
                    <button
                      onClick={() => navigate(`/doctor/patient/${patient.patient_id}?tab=timeline`)}
                      className="rounded-lg border border-hairline bg-bg-mist py-2 text-xs font-mono text-ink hover:bg-surface-card transition-colors"
                    >
                      Timeline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
