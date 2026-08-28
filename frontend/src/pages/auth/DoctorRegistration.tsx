import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/services/client";
import { Stethoscope, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export const DoctorRegistrationPage: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+1-555-0100");
  const [password, setPassword] = useState("");
  const [specialization, setSpecialization] = useState("Cardiology & Internal Medicine");
  const [licenseNumber, setLicenseNumber] = useState("MD-994821");
  const [hospitalName, setHospitalName] = useState("St. Jude Medical Center");
  const [experienceYears, setExperienceYears] = useState<number>(10);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !licenseNumber) {
      setErrorMsg("Full name, email, password, and license number are required.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const res = await fetch(`${API_BASE_URL}/api/auth/register-doctor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email,
          phone,
          password,
          specialization,
          license_number: licenseNumber,
          hospital_name: hospitalName,
          experience_years: experienceYears,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to register doctor account.");
      }

      setSuccessMsg("Doctor account registered successfully! Redirecting to Command Center...");
      setTimeout(() => {
        navigate("/doctor/dashboard");
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to register account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-mist flex items-center justify-center p-6 font-sans text-ink">
      <div className="w-full max-w-lg bg-surface-card rounded-2xl border border-hairline p-8 space-y-6 shadow-sm">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink text-bg-mist">
            <Stethoscope className="h-5 w-5" />
          </span>
          <h1 className="font-display text-2xl tracking-tight font-semibold">Doctor Professional Registration</h1>
          <p className="font-mono text-xs text-stone">
            Create your licensed doctor account to manage patient panels and clinical workflows.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-clay-alert/30 bg-clay-alert/5 p-4 text-xs font-mono text-clay-alert flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-teal-deep/30 bg-teal-deep/5 p-4 text-xs font-mono text-teal-deep flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Sarah Smith"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dr.smith@medsys.ai"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1-555-0100"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Password *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Specialization</label>
              <input
                type="text"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="Cardiology & Internal Medicine"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Medical License No. *</label>
              <input
                type="text"
                required
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="MD-994821"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Hospital / Clinic Name</label>
              <input
                type="text"
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="St. Jude Medical Center"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Years of Experience</label>
              <input
                type="number"
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value))}
                placeholder="10"
                className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-ink py-3 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-4"
          >
            <span>{loading ? "Registering Doctor Account..." : "Complete Doctor Registration"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
