import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { LoadError } from "@/components/LoadError";
import { getProfile, saveProfile } from "@/services/profile";
import type { ProfileInput } from "@/services/profile";
import type { ProfileRecord } from "@/types";

function getBmiCategory(bmi: number): { label: string; colorClass: string; bgClass: string; pct: number } {
  if (bmi <= 0) return { label: "Unknown", colorClass: "text-stone", bgClass: "bg-stone/20", pct: 0 };
  if (bmi < 18.5) return { label: "Underweight", colorClass: "text-amber-500", bgClass: "bg-amber-500/20", pct: 20 };
  if (bmi <= 24.9) return { label: "Normal Weight", colorClass: "text-emerald-500", bgClass: "bg-emerald-500/20", pct: 50 };
  if (bmi <= 29.9) return { label: "Overweight", colorClass: "text-orange-500", bgClass: "bg-orange-500/20", pct: 75 };
  return { label: "Obese", colorClass: "text-rose-500", bgClass: "bg-rose-500/20", pct: 95 };
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileRecord | null | undefined>(undefined);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);


  useEffect(() => {
    let active = true;
    setLoadError(false);
    getProfile()
      .then((p) => {
        if (!active) return;
        setProfile(p);
        setEditing(!p);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [retryKey]);

  async function handleSave(input: ProfileInput) {
    setSaving(true);
    setError(null);
    try {
      const saved = await saveProfile(input);
      setProfile(saved);
      setEditing(false);
    } catch {
      setError("Couldn't save your profile — try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCopyPhone(phone: string) {
    navigator.clipboard.writeText(phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loadError) {
    return (
      <div>
        <PageHeader eyebrow="Profile" title="Record" />
        <LoadError
          message="Couldn't load your profile — the backend may be unreachable."
          onRetry={() => setRetryKey((k) => k + 1)}
        />
      </div>
    );
  }

  if (profile === undefined) {
    return (
      <div>
        <PageHeader eyebrow="Profile" title="Record" />
        <p className="px-5 py-16 text-center text-sm text-stone sm:px-8">
          Loading your record…
        </p>
      </div>
    );
  }

  if (editing) {
    return (
      <div>
        <PageHeader
          eyebrow="Profile"
          title={profile ? profile.fullName : "Set up your record"}
          meta={profile ? "Edit record" : "Tell us about yourself to get started"}
        />
        <ProfileForm
          initial={profile}
          saving={saving}
          error={error}
          onCancel={profile ? () => setEditing(false) : undefined}
          onSave={handleSave}
        />
      </div>
    );
  }

  if (!profile) return null;

  const bmiCat = getBmiCategory(profile.bmi ?? 22.5);
  const initials = profile.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "P";

  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Patient Medical Passport"
        title="Health Profile & Vitals"
        action={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 rounded-full border border-hairline bg-surface-card px-4 py-2 text-[13px] font-medium text-ink transition-all hover:border-teal-deep hover:bg-teal-deep/5 active:scale-95"
          >
            {/* Pencil SVG */}
            <svg className="h-4 w-4 text-teal-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Record
          </button>
        }
      />

      <div className="mx-auto max-w-6xl px-5 pt-6 sm:px-8">
        {/* PATIENT PASSPORT HEADER CARD */}
        <div className="relative overflow-hidden rounded-2xl border border-hairline bg-surface-card p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-teal-deep text-xl font-bold tracking-wider text-bg-mist shadow-md">
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  {profile.fullName}
                </h1>
                <p className="mt-1 text-[13px] text-stone">
                  {profile.age} yrs • {profile.heightCm} cm • {profile.weightKg} kg
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Blood Group Badge */}
              <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-50/10 px-4 py-2 text-rose-600 dark:text-rose-400">
                {/* Heart / Blood SVG */}
                <svg className="h-4 w-4 shrink-0 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                </svg>
                <div className="text-left">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-stone">Blood Group</span>
                  <span className="font-mono text-[15px] font-bold">{profile.bloodGroup || "N/A"}</span>
                </div>
              </div>

              {/* BMI Status Pill */}
              <div className={`flex items-center gap-2 rounded-xl border border-hairline px-4 py-2 ${bmiCat.bgClass}`}>
                {/* Scale SVG */}
                <svg className={`h-4 w-4 shrink-0 ${bmiCat.colorClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <div className="text-left">
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-stone">BMI Index</span>
                  <span className={`font-mono text-[15px] font-bold ${bmiCat.colorClass}`}>
                    {(profile.bmi ?? 22.5).toFixed(1)} <span className="text-[12px] font-medium">({bmiCat.label})</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* BMI Visual Progress Bar */}
          <div className="mt-6 border-t border-hairline/60 pt-4">
            <div className="flex items-center justify-between text-[11px] font-mono text-stone mb-1.5">
              <span>Underweight (&lt;18.5)</span>
              <span>Normal (18.5-24.9)</span>
              <span>Overweight (25-29.9)</span>
              <span>Obese (&gt;30)</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-bg-mist">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-emerald-500 to-rose-500 transition-all duration-500"
                style={{ width: `${Math.min(Math.max(bmiCat.pct, 5), 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2-COLUMN MAIN CONTENT GRID */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          
          {/* LEFT 2 COLUMNS: VITAL METRICS & MEDICAL HISTORY */}
          <div className="flex flex-col gap-8 lg:col-span-2">
            
            {/* VITAL STAT CARDS */}
            <div>
              <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                Vital Measurements
              </h2>
              <div className="grid grid-cols-3 gap-4">
                
                {/* Age Card */}
                <div className="rounded-2xl border border-hairline bg-surface-card p-4 transition-all hover:border-teal-deep/30">
                  <div className="flex items-center gap-2 text-stone mb-2">
                    <svg className="h-4 w-4 text-teal-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-mono text-[11px] uppercase tracking-wider">Age</span>
                  </div>
                  <p className="font-mono text-xl font-semibold text-ink">{profile.age} <span className="text-[13px] font-normal text-stone">yrs</span></p>
                </div>

                {/* Weight Card */}
                <div className="rounded-2xl border border-hairline bg-surface-card p-4 transition-all hover:border-teal-deep/30">
                  <div className="flex items-center gap-2 text-stone mb-2">
                    <svg className="h-4 w-4 text-teal-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                    </svg>
                    <span className="font-mono text-[11px] uppercase tracking-wider">Weight</span>
                  </div>
                  <p className="font-mono text-xl font-semibold text-ink">{profile.weightKg} <span className="text-[13px] font-normal text-stone">kg</span></p>
                </div>

                {/* Height Card */}
                <div className="rounded-2xl border border-hairline bg-surface-card p-4 transition-all hover:border-teal-deep/30">
                  <div className="flex items-center gap-2 text-stone mb-2">
                    <svg className="h-4 w-4 text-teal-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="font-mono text-[11px] uppercase tracking-wider">Height</span>
                  </div>
                  <p className="font-mono text-xl font-semibold text-ink">{profile.heightCm} <span className="text-[13px] font-normal text-stone">cm</span></p>
                </div>

              </div>
            </div>

            {/* MEDICAL HISTORY / CONDITIONS TAG CLOUD */}
            <div className="rounded-2xl border border-hairline bg-surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-teal-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                    Active Conditions & History
                  </h2>
                </div>
                <span className="rounded-full bg-bg-mist px-2.5 py-0.5 font-mono text-[11px] text-stone">
                  {profile.conditions.length} Recorded
                </span>
              </div>

              {profile.conditions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-hairline py-8 text-center">
                  <p className="text-[13px] text-stone">No conditions recorded in your medical history.</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {profile.conditions.map((condition, idx) => (
                    <div
                      key={idx}
                      className="group flex items-center gap-2 rounded-xl border border-hairline bg-bg-mist/60 px-3.5 py-2 text-[13px] font-medium text-ink transition-all hover:border-teal-deep/40 hover:bg-surface-card"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-deep" />
                      <span>{condition}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: EMERGENCY CONTACT & MEDICATIONS */}
          <div className="flex flex-col gap-8">
            
            {/* EMERGENCY CONTACT SOS CARD */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-surface-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {/* SOS Phone SVG */}
                  <svg className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
                    Emergency Contact
                  </h2>
                </div>
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
                  Primary SOS
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-lg font-semibold text-ink">{profile.emergencyContact?.name || "None set"}</p>
                <p className="text-[12px] text-stone">Relation: <span className="font-medium text-ink">{profile.emergencyContact?.relation || "N/A"}</span></p>
                
                {profile.emergencyContact?.phone && (
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-bg-mist p-3">
                    <span className="font-mono text-[14px] font-medium text-ink">
                      {profile.emergencyContact.phone}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(profile.emergencyContact?.phone || "")}
                        className="flex items-center gap-1 rounded-lg border border-hairline px-2.5 py-1 text-[11px] font-medium text-stone hover:bg-surface-card active:scale-95 transition-all"
                      >
                        {copied ? (
                          <span className="text-emerald-500 font-semibold">Copied!</span>
                        ) : (
                          <>
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCallModal(true)}
                        className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 active:scale-95 transition-all"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>Call SOS</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* MEDICATIONS CARDS */}
            <div className="rounded-2xl border border-hairline bg-surface-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {/* Pill SVG */}
                  <svg className="h-4 w-4 text-teal-deep" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a6.5 6.5 0 00-9.192-9.192l-5.612 5.612a6.5 6.5 0 009.192 9.192l5.612-5.612z" />
                  </svg>
                  <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
                    Active Medications
                  </h2>
                </div>
                <span className="rounded-full bg-bg-mist px-2.5 py-0.5 font-mono text-[11px] text-stone">
                  {profile.medications.length} Prescribed
                </span>
              </div>

              {profile.medications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-hairline py-8 text-center">
                  <p className="text-[13px] text-stone">No active medications on record.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {profile.medications.map((m, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-hairline bg-bg-mist/50 p-3.5 transition-all hover:border-teal-deep/30"
                    >
                      <div>
                        <p className="text-[14px] font-semibold text-ink">{m.name}</p>
                        <p className="text-[12px] text-stone">Dosage: {m.dosage || "As directed"}</p>
                      </div>
                      <span className="rounded-full bg-teal-deep/10 px-2.5 py-1 font-mono text-[11px] font-medium text-teal-deep">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>

      {/* CONFIRM EMERGENCY CALL MODAL */}
      {showCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-500 mb-3">
              <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-lg font-semibold text-ink">Confirm Emergency Call</h3>
            </div>
            <p className="text-[13px] leading-relaxed text-stone mb-6">
              Are you sure you want to call emergency contact <span className="font-semibold text-ink">{profile.emergencyContact?.name || "SOS"}</span> ({profile.emergencyContact?.relation || "Contact"}) at <span className="font-mono font-medium text-ink">{profile.emergencyContact?.phone || ""}</span>?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowCallModal(false)}
                className="rounded-full border border-hairline px-4 py-2 text-[13px] font-medium text-stone hover:bg-bg-mist active:scale-95 transition-all"
              >
                Cancel
              </button>
              <a
                href={`tel:${profile.emergencyContact?.phone || ""}`}
                onClick={() => setShowCallModal(false)}
                className="flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-[13px] font-medium text-white shadow-md hover:bg-amber-600 active:scale-95 transition-all"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Confirm & Call
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

