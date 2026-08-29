import { useState } from "react";
import type { FormEvent } from "react";
import type { ProfileRecord } from "@/types";

import type { ProfileInput } from "@/services/profile";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const EMPTY: ProfileInput = {
  fullName: "",
  age: 0,
  weightKg: 0,
  heightCm: 0,
  bloodGroup: "",
  conditions: [],
  medications: [],
  emergencyContact: { name: "", relation: "", phone: "" },
};

const inputClass =
  "w-full rounded-lg border border-hairline bg-bg-mist px-3 py-2 text-[14px] text-ink placeholder:text-stone/60 focus:border-teal-deep focus:outline-none";
const labelClass = "mb-1.5 block text-[12px] text-stone";

interface ProfileFormProps {
  initial: ProfileRecord | null;
  saving: boolean;
  error: string | null;
  onCancel?: () => void;
  onSave: (input: ProfileInput) => void;
}

export function ProfileForm({ initial, saving, error, onCancel, onSave }: ProfileFormProps) {
  const [form, setForm] = useState<ProfileInput>(() => {
    const base = initial ? { ...initial } : EMPTY;
    if (!base.fullName || base.fullName.trim().toLowerCase() === "patient") {
      base.fullName = "John Doe";
    }
    return base;
  });

  function update<K extends keyof ProfileInput>(key: K, value: ProfileInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSave({
      ...form,
      conditions: form.conditions.map((c) => c.trim()).filter(Boolean),
      medications: form.medications
        .map((m) => ({ name: m.name.trim(), dosage: m.dosage.trim() }))
        .filter((m) => m.name),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 pb-16 pt-8 sm:px-8">
      <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
            Measurements
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Full name</label>
              <input
                required
                className={inputClass}
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Age</label>
                <input
                  required
                  type="number"
                  min={0}
                  className={inputClass}
                  value={form.age || ""}
                  onChange={(e) => update("age", Number(e.target.value))}
                />
              </div>
              <div>
                <label className={labelClass}>Blood group</label>
                <select
                  required
                  className={inputClass}
                  value={form.bloodGroup}
                  onChange={(e) => update("bloodGroup", e.target.value)}
                >
                  <option value="" disabled>
                    Select
                  </option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Weight (kg)</label>
                <input
                  required
                  type="number"
                  min={0}
                  step={0.1}
                  className={inputClass}
                  value={form.weightKg || ""}
                  onChange={(e) => update("weightKg", Number(e.target.value))}
                />
              </div>
              <div>
                <label className={labelClass}>Height (cm)</label>
                <input
                  required
                  type="number"
                  min={0}
                  step={0.1}
                  className={inputClass}
                  value={form.heightCm || ""}
                  onChange={(e) => update("heightCm", Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
            Emergency contact
          </h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Name</label>
              <input
                required
                className={inputClass}
                value={form.emergencyContact?.name || ""}
                onChange={(e) =>
                  update("emergencyContact", { name: e.target.value, relation: form.emergencyContact?.relation || "", phone: form.emergencyContact?.phone || "" })
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Relation</label>
                <input
                  required
                  className={inputClass}
                  value={form.emergencyContact?.relation || ""}
                  onChange={(e) =>
                    update("emergencyContact", {
                      name: form.emergencyContact?.name || "",
                      relation: e.target.value,
                      phone: form.emergencyContact?.phone || "",
                    })
                  }
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  required
                  className={inputClass}
                  value={form.emergencyContact?.phone || ""}
                  onChange={(e) =>
                    update("emergencyContact", {
                      name: form.emergencyContact?.name || "",
                      relation: form.emergencyContact?.relation || "",
                      phone: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
              History
            </h2>
            <button
              type="button"
              onClick={() => update("conditions", [...form.conditions, ""])}
              className="flex items-center gap-1 text-[12px] text-teal-deep hover:opacity-80 font-medium"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add condition
            </button>
          </div>
          {form.conditions.length === 0 ? (
            <p className="text-[13px] text-stone">No conditions on record.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {form.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder="Condition"
                    value={c}
                    onChange={(e) => {
                      const next = [...form.conditions];
                      next[i] = e.target.value;
                      update("conditions", next);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "conditions",
                        form.conditions.filter((_, idx) => idx !== i),
                      )
                    }
                    aria-label="Remove condition"
                    className="shrink-0 text-stone hover:text-clay-alert p-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
              Medications
            </h2>
            <button
              type="button"
              onClick={() =>
                update("medications", [...form.medications, { name: "", dosage: "" }])
              }
              className="flex items-center gap-1 text-[12px] text-teal-deep hover:opacity-80 font-medium"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add medication
            </button>
          </div>
          {form.medications.length === 0 ? (
            <p className="text-[13px] text-stone">No medications on record.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {form.medications.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder="Name"
                    value={m.name}
                    onChange={(e) => {
                      const next = [...form.medications];
                      next[i] = { ...next[i], name: e.target.value };
                      update("medications", next);
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Dosage"
                    value={m.dosage}
                    onChange={(e) => {
                      const next = [...form.medications];
                      next[i] = { ...next[i], dosage: e.target.value };
                      update("medications", next);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "medications",
                        form.medications.filter((_, idx) => idx !== i),
                      )
                    }
                    aria-label="Remove medication"
                    className="shrink-0 text-stone hover:text-clay-alert p-1"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

        </section>
      </div>

      {error && <p className="mt-6 text-[13px] text-clay-alert">{error}</p>}

      <div className="mt-8 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-teal-deep px-5 py-2.5 text-[13px] font-medium text-bg-mist transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-hairline px-5 py-2.5 text-[13px] text-ink transition-colors hover:bg-surface-card"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
