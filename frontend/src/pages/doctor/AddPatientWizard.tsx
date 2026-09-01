import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { API_BASE_URL, authHeaders } from "@/services/client";
import { UserPlus, ArrowRight, ArrowLeft, Sparkles, AlertCircle, Plus, Trash2 } from "lucide-react";

export const AddPatientWizard: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("1995-04-12");
  const [gender, setGender] = useState("Male");
  const [phone, setPhone] = useState("+1-555-0199");
  const [email, setEmail] = useState("");
  const [heightCm, setHeightCm] = useState<number>(175);
  const [weightKg, setWeightKg] = useState<number>(70);

  const [bloodGroup, setBloodGroup] = useState("O+");
  const [allergies, setAllergies] = useState<Array<{ allergen: string; severity: string }>>([
    { allergen: "Penicillin", severity: "severe" },
  ]);
  const [conditions, setConditions] = useState<Array<{ condition_name: string }>>([
    { condition_name: "Mild Hypertension" },
  ]);
  const [emergencyName, setEmergencyName] = useState("Jane Doe");
  const [emergencyPhone, setEmergencyPhone] = useState("+1-555-0199");

  const [reason, setReason] = useState("Routine initial onboarding & blood pressure check");
  const [symptoms, setSymptoms] = useState("Occasional mild headache");
  const [notes, setNotes] = useState("Patient requested comprehensive medical profile setup");

  const handleAddAllergy = () => {
    setAllergies([...allergies, { allergen: "", severity: "moderate" }]);
  };

  const handleRemoveAllergy = (idx: number) => {
    setAllergies(allergies.filter((_, i) => i !== idx));
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { condition_name: "" }]);
  };

  const handleRemoveCondition = (idx: number) => {
    setConditions(conditions.filter((_, i) => i !== idx));
  };

  const handleSubmitWizard = async () => {
    if (!firstName || !lastName || !email) {
      setErrorMsg("First name, last name, and email are required.");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const payload = {
        identity: {
          first_name: firstName,
          last_name: lastName,
          dob,
          gender,
          phone,
          email,
          height_cm: heightCm,
          weight_kg: weightKg,
        },
        medical: {
          blood_group: bloodGroup,
          allergies,
          conditions,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
        },
        clinical: {
          registration_reason: reason,
          initial_symptoms: symptoms,
          initial_doctor_notes: notes,
        },
      };

      const res = await fetch(`${API_BASE_URL}/api/auth/add-patient-wizard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create patient");
      }

      const data = await res.json();
      navigate(`/doctor/patient/${data.patient_id}`);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create patient record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      <PageHeader
        eyebrow="Doctor Clinical Workflow"
        title="Register New Patient"
        meta="3-step registration wizard to create an active patient clinical record."
      />

      <div className="px-5 sm:px-8 max-w-4xl mx-auto space-y-8">
        {/* Wizard Progress Bar */}
        <div className="flex items-center justify-between border-b border-hairline pb-4 font-mono text-xs">
          {[
            { num: 1, title: "1. Identity & Physicals" },
            { num: 2, title: "2. Medical History" },
            { num: 3, title: "3. Clinical Intake" },
          ].map((s) => (
            <div
              key={s.num}
              className={`flex items-center gap-2 font-semibold ${
                step === s.num
                  ? "text-teal-deep border-b-2 border-teal-deep pb-1"
                  : step > s.num
                  ? "text-stone"
                  : "text-stone/40"
              }`}
            >
              <span>{s.title}</span>
            </div>
          ))}
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-clay-alert/30 bg-clay-alert/5 p-4 text-xs font-mono text-clay-alert flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: IDENTITY & PHYSICAL METRICS */}
        {step === 1 && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6 shadow-xs">
            <h2 className="font-display text-lg tracking-tight text-ink font-semibold border-b border-hairline pb-3">
              Step 1: Patient Identity & Physical Metrics
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. John"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Doe"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Date of Birth *</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Height (cm) *</label>
                <input
                  type="number"
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  placeholder="178"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Weight (kg) *</label>
                <input
                  type="number"
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value))}
                  placeholder="75"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Phone Number *</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1-555-0123"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Patient Email * (Required for Activation)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john.doe@example.com"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => {
                  if (!firstName || !lastName || !email) {
                    setErrorMsg("First name, last name, and email are required.");
                    return;
                  }
                  setErrorMsg(null);
                  setStep(2);
                }}
                className="rounded-xl bg-ink px-6 py-2.5 font-mono text-xs text-bg-mist hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <span>Continue to Medical History</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: MEDICAL HISTORY */}
        {step === 2 && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6 shadow-xs">
            <h2 className="font-display text-lg tracking-tight text-ink font-semibold border-b border-hairline pb-3">
              Step 2: Basic Medical History & Emergency Contact
            </h2>

            <div className="space-y-4">
              <div className="space-y-1 max-w-xs">
                <label className="font-mono text-xs text-stone">Blood Group</label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                >
                  <option value="O+">O Positive (O+)</option>
                  <option value="O-">O Negative (O-)</option>
                  <option value="A+">A Positive (A+)</option>
                  <option value="A-">A Negative (A-)</option>
                  <option value="B+">B Positive (B+)</option>
                  <option value="B-">B Negative (B-)</option>
                  <option value="AB+">AB Positive (AB+)</option>
                  <option value="AB-">AB Negative (AB-)</option>
                </select>
              </div>

              {/* Conditions List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs text-stone font-semibold">Existing Chronic Conditions</label>
                  <button
                    onClick={handleAddCondition}
                    className="text-xs font-mono text-teal-deep flex items-center gap-1 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Condition</span>
                  </button>
                </div>
                {conditions.map((cond, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={cond.condition_name}
                      onChange={(e) => {
                        const copy = [...conditions];
                        copy[idx].condition_name = e.target.value;
                        setConditions(copy);
                      }}
                      placeholder="e.g. Mild Hypertension, Diabetes Type 2"
                      className="flex-1 rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
                    />
                    {conditions.length > 1 && (
                      <button onClick={() => handleRemoveCondition(idx)} className="text-stone hover:text-clay-alert p-2">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Allergies List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs text-stone font-semibold">Known Allergies</label>
                  <button
                    onClick={handleAddAllergy}
                    className="text-xs font-mono text-teal-deep flex items-center gap-1 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Allergy</span>
                  </button>
                </div>
                {allergies.map((alg, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={alg.allergen}
                      onChange={(e) => {
                        const copy = [...allergies];
                        copy[idx].allergen = e.target.value;
                        setAllergies(copy);
                      }}
                      placeholder="Allergen name (e.g. Penicillin, Peanuts)"
                      className="flex-1 rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
                    />
                    <select
                      value={alg.severity}
                      onChange={(e) => {
                        const copy = [...allergies];
                        copy[idx].severity = e.target.value;
                        setAllergies(copy);
                      }}
                      className="rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
                    >
                      <option value="mild">Mild</option>
                      <option value="moderate">Moderate</option>
                      <option value="severe">Severe</option>
                    </select>
                    {allergies.length > 1 && (
                      <button onClick={() => handleRemoveAllergy(idx)} className="text-stone hover:text-clay-alert p-2">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Emergency Contact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <label className="font-mono text-xs text-stone">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-xs text-stone">Emergency Contact Phone</label>
                  <input
                    type="text"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="+1-555-0199"
                    className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(1)}
                className="rounded-xl border border-hairline bg-surface-card px-5 py-2.5 font-mono text-xs text-ink hover:bg-bg-mist flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setStep(3)}
                className="rounded-xl bg-ink px-6 py-2.5 font-mono text-xs text-bg-mist hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <span>Continue to Clinical Intake</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CLINICAL INTAKE */}
        {step === 3 && (
          <div className="rounded-2xl border border-hairline bg-surface-card p-6 space-y-6 shadow-xs">
            <h2 className="font-display text-lg tracking-tight text-ink font-semibold border-b border-hairline pb-3">
              Step 3: Initial Clinical Notes (Optional)
            </h2>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Registration Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for adding patient to panel"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Initial Reported Symptoms</label>
                <input
                  type="text"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. Mild fatigue, dry cough"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs text-stone">Doctor Clinical Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Initial observations recorded by doctor during onboarding..."
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 font-sans text-sm text-ink outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep(2)}
                className="rounded-xl border border-hairline bg-surface-card px-5 py-2.5 font-mono text-xs text-ink hover:bg-bg-mist flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                disabled={loading}
                onClick={handleSubmitWizard}
                className="rounded-xl bg-teal-deep px-6 py-2.5 font-mono text-xs text-bg-mist hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <span>{loading ? "Creating Patient Record..." : "Create Patient Record"}</span>
                <Sparkles className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
