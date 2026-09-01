import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { fetchAssignedPatients, linkExistingPatient, searchPatients } from "@/services/clinicalService";
import { ApiError } from "@/services/client";
import type { DoctorPatientAssignment } from "@/types";
import { Search, UserPlus, ArrowRight, ShieldCheck, Link2, X } from "lucide-react";

export const MyPatients: React.FC = () => {
  const [patients, setPatients] = useState<DoctorPatientAssignment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkIdentifier, setLinkIdentifier] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      setLoading(true);
      const res = await fetchAssignedPatients();
      setPatients(res);
    } catch (err) {
      console.error("Failed to load patients", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    try {
      const res = await searchPatients(query);
      setPatients(res);
    } catch (err) {
      console.error("Search failed", err);
    }
  };

  const handleLinkPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkIdentifier.trim()) return;
    try {
      setLinking(true);
      setLinkError(null);
      await linkExistingPatient(linkIdentifier.trim());
      setShowLinkModal(false);
      setLinkIdentifier("");
      await loadPatients();
    } catch (err) {
      setLinkError(err instanceof ApiError && err.detail ? err.detail : "Couldn't find or link that patient — check the email or Patient ID.");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Doctor Clinical Panel"
        title="My Patients Directory"
        meta="Search and select authorized patients assigned to your clinical care."
      />

      <div className="px-5 sm:px-8 space-y-6">
        {/* Search & Add Patient Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-stone" />
            <input
              type="text"
              placeholder="Search patients by name or ID (e.g. John, pat_01)..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-surface-card py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-stone/60 outline-none focus:border-teal-deep"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowLinkModal(true)}
              className="flex-1 sm:flex-none rounded-xl border border-hairline bg-surface-card px-5 py-2.5 text-xs font-mono text-ink hover:border-teal-deep hover:text-teal-deep transition-colors flex items-center justify-center gap-2 shadow-xs"
            >
              <Link2 className="h-4 w-4" />
              <span>Link Existing Patient</span>
            </button>
            <button
              onClick={() => navigate("/doctor/add-patient")}
              className="flex-1 sm:flex-none rounded-xl bg-ink px-5 py-2.5 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-xs"
            >
              <UserPlus className="h-4 w-4" />
              <span>+ Add Patient Wizard</span>
            </button>
          </div>
        </div>

        {/* Patients Grid */}
        {!loading && patients.length === 0 && (
          <div className="rounded-2xl border border-dashed border-hairline py-12 text-center">
            <p className="text-sm text-stone">No patients assigned yet.</p>
            <p className="text-xs text-stone/70 mt-1">Link an existing patient or run the Add Patient Wizard to get started.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {patients.map((pat) => (
            <div
              key={pat.id}
              className="rounded-2xl border border-hairline bg-surface-card p-5 space-y-4 shadow-xs flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display font-semibold text-ink text-base">{pat.patient_name}</span>
                  <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-teal-deep/10 text-teal-deep">
                    {pat.status}
                  </span>
                </div>
                <p className="font-mono text-xs text-stone">
                  ID: <span className="text-ink font-semibold">{pat.patient_id}</span> • Age: {pat.patient_age ?? "—"} • {pat.patient_gender || "—"}
                </p>
                <div className="flex items-center gap-1 font-mono text-[11px] text-stone pt-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-deep" />
                  <span>Authorized Doctor Access</span>
                </div>
              </div>

              <button
                onClick={() => navigate(`/doctor/patient/${pat.patient_id}`)}
                className="w-full rounded-lg bg-bg-mist border border-hairline py-2 text-xs font-mono text-ink hover:bg-surface-card transition-colors flex items-center justify-center gap-1 mt-2"
              >
                <span>Open Workspace</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Link Existing Patient Modal */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface-card p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-teal-deep" />
                <h3 className="font-display text-base font-semibold text-ink">Link Existing Patient</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkError(null);
                  setLinkIdentifier("");
                }}
                className="rounded-lg p-1 text-stone hover:bg-bg-mist hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-stone leading-relaxed">
              Add a patient who already has a MedSys account to your panel — enter their account email or Patient ID (e.g. PAT-000128).
            </p>

            <form onSubmit={handleLinkPatient} className="space-y-3">
              <input
                type="text"
                autoFocus
                required
                value={linkIdentifier}
                onChange={(e) => setLinkIdentifier(e.target.value)}
                placeholder="patient@example.com or PAT-000128"
                className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
              />

              {linkError && (
                <p className="text-xs text-clay-alert font-medium">{linkError}</p>
              )}

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkModal(false);
                    setLinkError(null);
                    setLinkIdentifier("");
                  }}
                  className="rounded-xl border border-hairline px-4 py-2 text-xs font-medium text-stone hover:bg-bg-mist"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={linking}
                  className="rounded-xl bg-teal-deep px-5 py-2 text-xs font-medium text-bg-mist shadow-xs hover:bg-teal-deep/90 disabled:opacity-50"
                >
                  {linking ? "Linking..." : "Link Patient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
