import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Stethoscope,
  Building2,
  Award,
  Calendar,
  Phone,
  Mail,
  Users,
  FileCheck,
  AlertTriangle,
  Activity,
  Edit3,
  CheckCircle2,
  ShieldCheck,
  ExternalLink,
  X,
  Save,
} from "lucide-react";

export interface DoctorProfileData {
  fullName: string;
  title: string;
  specialty: string;
  licenseNumber: string;
  hospital: string;
  experienceYears: number;
  email: string;
  phone: string;
  consultationHours: string;
  bio: string;
  specializations: string[];
  boardCertifications: string[];
}

export const DEFAULT_DOCTOR_PROFILE: DoctorProfileData = {
  fullName: "Dr. Sarah Smith",
  title: "Senior Cardiologist & Clinical Lead",
  specialty: "Cardiology & Internal Medicine",
  licenseNumber: "NMC-89241-IN",
  hospital: "Apollo Medical Center & MedSys Virtual Clinic",
  experienceYears: 12,
  email: "dr.sarah.smith@medsys.ai",
  phone: "+1 (555) 234-5678",
  consultationHours: "Mon - Fri: 09:00 AM - 05:00 PM",
  bio: "Board-certified physician specializing in interventional cardiology, cardiovascular risk reduction, and AI-assisted clinical decision support.",
  specializations: [
    "Interventional Cardiology",
    "Hypertension & Risk Reduction",
    "Electrocardiography (ECG)",
    "Emergency Clinical Triage",
    "Pharmacotherapy & Med Safety",
  ],
  boardCertifications: [
    "American Board of Internal Medicine (ABIM)",
    "Fellow of the American College of Cardiology (FACC)",
    "National Board of Medical Examiners (NBME)",
  ],
};

interface DoctorProfileViewProps {
  doctorData: DoctorProfileData;
  clerkUser?: {
    fullName?: string | null;
    primaryEmailAddress?: { emailAddress: string } | null;
    imageUrl?: string;
  } | null;
  onUpdateDoctor: (updated: DoctorProfileData) => void;
}

export const DoctorProfileView: React.FC<DoctorProfileViewProps> = ({
  doctorData,
  clerkUser,
  onUpdateDoctor,
}) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<DoctorProfileData>(doctorData);

  const displayName = clerkUser?.fullName || doctorData.fullName;
  const displayEmail = clerkUser?.primaryEmailAddress?.emailAddress || doctorData.email;

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "DR";

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDoctor(formData);
    setEditing(false);
  };

  return (
    <div className="space-y-8 pb-20">
      {/* DOCTOR PASSPORT HEADER CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            {clerkUser?.imageUrl ? (
              <img
                src={clerkUser.imageUrl}
                alt={displayName}
                className="h-20 w-20 rounded-2xl border-2 border-teal-deep object-cover shadow-md"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-teal-deep text-2xl font-bold tracking-wider text-bg-mist shadow-md">
                {initials}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  {displayName}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-teal-deep/30 bg-teal-deep/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-teal-deep">
                  <ShieldCheck className="h-3.5 w-3.5" /> Licensed Doctor
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-teal-deep">{doctorData.title}</p>
              <p className="mt-0.5 text-xs text-stone">
                {doctorData.hospital} • License: {doctorData.licenseNumber}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFormData(doctorData);
                setEditing(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-hairline bg-bg-mist px-4 py-2 text-xs font-semibold text-ink shadow-2xs transition-all hover:border-teal-deep hover:bg-surface-card"
            >
              <Edit3 className="h-4 w-4 text-teal-deep" />
              Edit Profile
            </button>
          </div>
        </div>

        {/* Verification Status Bar */}
        <div className="mt-6 border-t border-hairline/60 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-stone">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span>Identity & Medical License Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-thread" />
            <span>e-Prescribing (e-Rx) Authorized</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-deep" />
            <span>HIPAA Audit Trail Active</span>
          </div>
        </div>
      </div>

      {/* CLINICAL PRACTICE STATS WIDGETS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-hairline bg-surface-card p-4 transition-all hover:border-teal-deep/30 shadow-2xs">
          <div className="flex items-center gap-2 text-stone mb-1.5">
            <Users className="h-4 w-4 text-teal-deep" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Active Patients</span>
          </div>
          <p className="font-mono text-2xl font-bold text-ink">24 <span className="text-xs font-normal text-stone">assigned</span></p>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-card p-4 transition-all hover:border-teal-deep/30 shadow-2xs">
          <div className="flex items-center gap-2 text-stone mb-1.5">
            <FileCheck className="h-4 w-4 text-indigo-thread" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Consultations</span>
          </div>
          <p className="font-mono text-2xl font-bold text-ink">142 <span className="text-xs font-normal text-stone">cases</span></p>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-card p-4 transition-all hover:border-teal-deep/30 shadow-2xs">
          <div className="flex items-center gap-2 text-stone mb-1.5">
            <Activity className="h-4 w-4 text-amber-500" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Lab Reviews</span>
          </div>
          <p className="font-mono text-2xl font-bold text-ink">5 <span className="text-xs font-normal text-stone">pending</span></p>
        </div>

        <div className="rounded-2xl border border-hairline bg-surface-card p-4 transition-all hover:border-teal-deep/30 shadow-2xs">
          <div className="flex items-center gap-2 text-stone mb-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Triage Alerts</span>
          </div>
          <p className="font-mono text-2xl font-bold text-rose-600">3 <span className="text-xs font-normal text-stone">triaged</span></p>
        </div>
      </div>

      {/* 2-COLUMN MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* LEFT 2 COLUMNS: PRACTICE DETAILS & SPECIALIZATIONS */}
        <div className="space-y-8 lg:col-span-2">
          {/* Clinical Practice Information */}
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xs space-y-6">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone font-semibold border-b border-hairline pb-2">
              Practice Information
            </h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <Stethoscope className="mt-0.5 h-5 w-5 text-teal-deep shrink-0" />
                <div>
                  <p className="font-mono text-xs text-stone">Primary Specialty</p>
                  <p className="font-medium text-sm text-ink">{doctorData.specialty}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="mt-0.5 h-5 w-5 text-teal-deep shrink-0" />
                <div>
                  <p className="font-mono text-xs text-stone">Hospital Affiliation</p>
                  <p className="font-medium text-sm text-ink">{doctorData.hospital}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Award className="mt-0.5 h-5 w-5 text-teal-deep shrink-0" />
                <div>
                  <p className="font-mono text-xs text-stone">Clinical Experience</p>
                  <p className="font-medium text-sm text-ink">{doctorData.experienceYears} Years of Active Practice</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="mt-0.5 h-5 w-5 text-teal-deep shrink-0" />
                <div>
                  <p className="font-mono text-xs text-stone">Consultation Hours</p>
                  <p className="font-medium text-sm text-ink">{doctorData.consultationHours}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-teal-deep shrink-0" />
                <div>
                  <p className="font-mono text-xs text-stone">Professional Email</p>
                  <p className="font-mono text-sm text-ink">{displayEmail}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-5 w-5 text-teal-deep shrink-0" />
                <div>
                  <p className="font-mono text-xs text-stone">Clinic Contact Phone</p>
                  <p className="font-mono text-sm text-ink">{doctorData.phone}</p>
                </div>
              </div>
            </div>

            {/* Doctor Bio */}
            <div className="border-t border-hairline pt-4">
              <p className="font-mono text-xs text-stone mb-1">Clinical Profile & Bio</p>
              <p className="text-sm leading-relaxed text-ink/80">{doctorData.bio}</p>
            </div>
          </div>

          {/* Clinical Specializations Tag Cloud */}
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xs space-y-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone font-semibold">
              Specialized Clinical Focus
            </h2>
            <div className="flex flex-wrap gap-2">
              {doctorData.specializations.map((spec, idx) => (
                <span
                  key={idx}
                  className="rounded-xl border border-teal-deep/30 bg-teal-deep/10 px-3 py-1.5 text-xs font-semibold text-teal-deep"
                >
                  {spec}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BOARD CERTIFICATIONS & QUICK ACTIONS */}
        <div className="space-y-6">
          {/* Board Certifications */}
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xs space-y-4">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone font-semibold border-b border-hairline pb-2">
              Board Certifications
            </h2>
            <div className="space-y-3">
              {doctorData.boardCertifications.map((cert, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500 shrink-0" />
                  <p className="text-xs font-medium text-ink">{cert}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Doctor Workstation Links */}
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xs space-y-3">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone font-semibold border-b border-hairline pb-2">
              Doctor Shortcuts
            </h2>

            <Link
              to="/doctor/dashboard"
              className="flex items-center justify-between rounded-xl border border-hairline bg-bg-mist p-3 text-xs font-semibold text-ink transition-all hover:border-teal-deep hover:text-teal-deep"
            >
              <div className="flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-teal-deep" />
                <span>Command Center</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>

            <Link
              to="/doctor/patients"
              className="flex items-center justify-between rounded-xl border border-hairline bg-bg-mist p-3 text-xs font-semibold text-ink transition-all hover:border-teal-deep hover:text-teal-deep"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-deep" />
                <span>My Patients</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>

            <Link
              to="/doctor/copilot"
              className="flex items-center justify-between rounded-xl border border-hairline bg-bg-mist p-3 text-xs font-semibold text-ink transition-all hover:border-teal-deep hover:text-teal-deep"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-deep" />
                <span>Clinical Copilot</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* DOCTOR PROFILE EDIT MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-hairline bg-surface-card p-6 shadow-xl space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <h3 className="font-display text-lg font-semibold text-ink">Edit Doctor Profile</h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg p-1 text-stone hover:bg-bg-mist hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-stone mb-1">Full Name & Title</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-stone mb-1">Professional Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-stone mb-1">Primary Specialty</label>
                  <input
                    type="text"
                    required
                    value={formData.specialty}
                    onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                    className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-stone mb-1">Medical License Number</label>
                  <input
                    type="text"
                    required
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-stone mb-1">Hospital / Clinic Affiliation</label>
                <input
                  type="text"
                  required
                  value={formData.hospital}
                  onChange={(e) => setFormData({ ...formData, hospital: e.target.value })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-stone mb-1">Years of Experience</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.experienceYears}
                    onChange={(e) => setFormData({ ...formData, experienceYears: Number(e.target.value) })}
                    className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-stone mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-stone mb-1">Consultation Hours</label>
                <input
                  type="text"
                  value={formData.consultationHours}
                  onChange={(e) => setFormData({ ...formData, consultationHours: e.target.value })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-stone mb-1">Clinical Biography</label>
                <textarea
                  rows={3}
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full rounded-xl border border-hairline bg-bg-mist px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-teal-deep"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl border border-hairline px-4 py-2 text-xs font-medium text-stone hover:bg-bg-mist"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-teal-deep px-5 py-2 text-xs font-medium text-bg-mist shadow-xs hover:bg-teal-deep/90"
                >
                  <Save className="h-4 w-4" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
