import React, { useState } from "react";
import { useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { Stethoscope, User, ArrowRight, ArrowLeft, AlertCircle, LogOut } from "lucide-react";
import { API_BASE_URL, setActiveRoleOverride, setDemoAuthenticated } from "@/services/client";

/**
 * Shown in place of the normal app shell the first time a signed-in Clerk
 * account has no linked doctor/patient record yet (see ProtectedLayout,
 * which checks GET /api/auth/me). Lets the new user pick a role, fills in
 * the role-specific details, and links their account via
 * /api/auth/register-doctor or /api/auth/register-patient — after which
 * ProtectedLayout re-renders the normal app.
 */
function preselectedRole(): "doctor" | "patient" | null {
  // Whichever role card the user clicked on /select-role (or the role
  // segment of the /sign-in|/sign-up URL they landed on) is already saved
  // here before Clerk auth even runs — see SelectRolePage/RoleLoginPage.
  // Reusing it here means a brand-new Clerk sign-in goes straight to the
  // correct registration form instead of asking "doctor or patient?" a
  // second time.
  try {
    const stored = localStorage.getItem("medsys_role");
    return stored === "doctor" || stored === "patient" ? stored : null;
  } catch {
    return null;
  }
}

export function ProfileSetup({ onComplete }: { onComplete: () => void }) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [role, setRole] = useState<"doctor" | "patient" | null>(preselectedRole);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setActiveRoleOverride(null);
    setDemoAuthenticated(false);
    try {
      localStorage.removeItem("medsys_role");
    } catch {}
    await signOut();
    navigate("/select-role", { replace: true });
  };

  const defaultName = user?.fullName || "";
  const defaultEmail = user?.primaryEmailAddress?.emailAddress || "";

  const submit = async (path: string, body: Record<string, unknown>) => {
    setSubmitting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Registration failed.");
      }
      onComplete();
    } catch (e: any) {
      setError(e.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (role === "doctor") {
    return (
      <SetupShell title="Doctor Registration" subtitle="A few professional details to finish setting up your account." onSignOut={handleSignOut}>
        <DoctorForm
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          submitting={submitting}
          error={error}
          onBack={() => setRole(null)}
          onSubmit={(body) => submit("/api/auth/register-doctor", body)}
        />
      </SetupShell>
    );
  }

  if (role === "patient") {
    return (
      <SetupShell title="Patient Registration" subtitle="A few details so your care team can look after you properly." onSignOut={handleSignOut}>
        <PatientForm
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          submitting={submitting}
          error={error}
          onBack={() => setRole(null)}
          onSubmit={(body) => submit("/api/auth/register-patient", body)}
        />
      </SetupShell>
    );
  }

  return (
    <SetupShell title="Welcome to MedSys AI" subtitle="Let's set up your profile — how will you be using MedSys?" onSignOut={handleSignOut}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setRole("doctor")}
          className="group text-left rounded-2xl border border-hairline bg-surface-card p-6 transition-all hover:border-ink hover:shadow-md space-y-3"
        >
          <div className="h-11 w-11 rounded-xl bg-ink/5 border border-hairline flex items-center justify-center text-ink group-hover:bg-ink group-hover:text-bg-mist transition-colors">
            <Stethoscope className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-display text-lg tracking-tight text-ink">I'm a Doctor</h3>
            <p className="mt-1 text-xs text-stone">Manage patient panels and clinical workflows.</p>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-ink font-semibold group-hover:text-teal-deep">
            <span>Continue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setRole("patient")}
          className="group text-left rounded-2xl border border-hairline bg-surface-card p-6 transition-all hover:border-ink hover:shadow-md space-y-3"
        >
          <div className="h-11 w-11 rounded-xl bg-ink/5 border border-hairline flex items-center justify-center text-ink group-hover:bg-ink group-hover:text-bg-mist transition-colors">
            <User className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-display text-lg tracking-tight text-ink">I'm a Patient</h3>
            <p className="mt-1 text-xs text-stone">Track your care, chat with MedSys, manage your health data.</p>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs text-ink font-semibold group-hover:text-teal-deep">
            <span>Continue</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>
      </div>
    </SetupShell>
  );
}

function SetupShell({
  title,
  subtitle,
  children,
  onSignOut,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  onSignOut: () => void;
}) {
  return (
    <div className="min-h-dvh bg-bg-mist text-ink flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight text-ink">{title}</h1>
          <p className="text-stone text-sm">{subtitle}</p>
        </div>
        {children}
        <div className="text-center">
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 font-mono text-xs text-stone hover:text-clay-alert transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Not you? Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="rounded-xl border border-clay-alert/30 bg-clay-alert/5 p-3 text-xs font-mono text-clay-alert flex items-center gap-2">
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  );
}

function inputClass() {
  return "w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep";
}

function BackAndSubmit({ onBack, submitting, label }: { onBack: () => void; submitting: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 rounded-xl border border-hairline px-4 py-3 font-mono text-xs text-stone hover:text-ink hover:bg-surface-card transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="flex-1 rounded-xl bg-ink py-3 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? "Saving…" : label}
      </button>
    </div>
  );
}

function DoctorForm({
  defaultName,
  defaultEmail,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  defaultName: string;
  defaultEmail: string;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState("");
  const [specialization, setSpecialization] = useState("General Practice");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [experienceYears, setExperienceYears] = useState<number>(5);

  return (
    <form
      className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          full_name: fullName,
          email,
          phone,
          specialization,
          license_number: licenseNumber,
          hospital_name: hospitalName,
          experience_years: experienceYears,
        });
      }}
    >
      <FieldError error={error} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name *">
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass()} placeholder="Dr. Sarah Smith" />
        </Field>
        <Field label="Email *">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} placeholder="you@hospital.org" />
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass()} placeholder="+1-555-0100" />
        </Field>
        <Field label="Specialization">
          <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Medical License No. *">
          <input required value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} className={inputClass()} placeholder="MD-994821" />
        </Field>
        <Field label="Hospital / Clinic Name">
          <input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Years of Experience">
          <input type="number" value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value))} className={inputClass()} />
        </Field>
      </div>
      <BackAndSubmit onBack={onBack} submitting={submitting} label="Complete Registration" />
    </form>
  );
}

function PatientForm({
  defaultName,
  defaultEmail,
  submitting,
  error,
  onBack,
  onSubmit,
}: {
  defaultName: string;
  defaultEmail: string;
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (body: Record<string, unknown>) => void;
}) {
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Male");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [heightCm, setHeightCm] = useState<number>(170);
  const [weightKg, setWeightKg] = useState<number>(70);
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  return (
    <form
      className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          full_name: fullName,
          email,
          dob,
          gender,
          blood_group: bloodGroup,
          height_cm: heightCm,
          weight_kg: weightKg,
          phone,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
        });
      }}
    >
      <FieldError error={error} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name *">
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass()} placeholder="John Doe" />
        </Field>
        <Field label="Email *">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} placeholder="you@example.com" />
        </Field>
        <Field label="Date of Birth *">
          <input required type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Gender">
          <select value={gender} onChange={(e) => setGender(e.target.value)} className={inputClass()}>
            <option>Male</option>
            <option>Female</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Blood Group">
          <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className={inputClass()}>
            {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((bg) => (
              <option key={bg}>{bg}</option>
            ))}
          </select>
        </Field>
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass()} placeholder="+1-555-0123" />
        </Field>
        <Field label="Height (cm)">
          <input type="number" value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} className={inputClass()} />
        </Field>
        <Field label="Weight (kg)">
          <input type="number" value={weightKg} onChange={(e) => setWeightKg(Number(e.target.value))} className={inputClass()} />
        </Field>
        <Field label="Emergency Contact Name">
          <input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} className={inputClass()} />
        </Field>
        <Field label="Emergency Contact Phone">
          <input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} className={inputClass()} />
        </Field>
      </div>
      <BackAndSubmit onBack={onBack} submitting={submitting} label="Complete Registration" />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-xs text-stone">{label}</label>
      {children}
    </div>
  );
}
