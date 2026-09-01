import type { ProfileRecord } from "@/types";
import type { DoctorProfileData } from "@/components/profile/DoctorProfileView";
import { ApiError, apiFetch, isMockMode, mockDelay } from "./client";
import { mockProfile } from "./mocks";

export type ProfileInput = Omit<ProfileRecord, "bmi">;

function computeBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return heightM > 0 ? Math.round((weightKg / (heightM * heightM)) * 10) / 10 : 0;
}

export async function getProfile(): Promise<ProfileRecord | null> {
  if (isMockMode) {
    try {
      const saved = localStorage.getItem("medsys_patient_profile");
      if (saved) return mockDelay(JSON.parse(saved));
    } catch {}
    return mockDelay(mockProfile);
  }
  try {
    return await apiFetch<ProfileRecord>("/profile");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function saveProfile(input: ProfileInput): Promise<ProfileRecord> {
  const computedBmi = computeBmi(input.weightKg ?? 70, input.heightCm ?? 170);
  const record: ProfileRecord = { ...input, bmi: computedBmi };
  if (isMockMode) {
    try {
      localStorage.setItem("medsys_patient_profile", JSON.stringify(record));
    } catch {}
    return mockDelay(record);
  }
  return apiFetch<ProfileRecord>("/profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

const DOCTOR_PROFILE_FALLBACK_KEY = "medsys_doctor_profile";

export async function getDoctorProfile(fallback: DoctorProfileData): Promise<DoctorProfileData> {
  if (isMockMode) {
    try {
      const saved = localStorage.getItem(DOCTOR_PROFILE_FALLBACK_KEY);
      if (saved) return mockDelay(JSON.parse(saved));
    } catch {}
    return mockDelay(fallback);
  }
  return apiFetch<DoctorProfileData>("/profile/doctor");
}

export async function saveDoctorProfile(input: DoctorProfileData): Promise<DoctorProfileData> {
  if (isMockMode) {
    try {
      localStorage.setItem(DOCTOR_PROFILE_FALLBACK_KEY, JSON.stringify(input));
    } catch {}
    return mockDelay(input);
  }
  return apiFetch<DoctorProfileData>("/profile/doctor", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
