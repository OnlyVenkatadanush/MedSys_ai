import type { ProfileRecord } from "@/types";
import { ApiError, apiFetch, isMockMode, mockDelay } from "./client";
import { mockProfile } from "./mocks";

export type ProfileInput = Omit<ProfileRecord, "bmi">;

function computeBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return heightM > 0 ? Math.round((weightKg / (heightM * heightM)) * 10) / 10 : 0;
}

/** Returns `null` when the signed-in user hasn't saved a profile yet. */
export async function getProfile(): Promise<ProfileRecord | null> {
  if (isMockMode) return mockDelay(mockProfile);
  try {
    return await apiFetch<ProfileRecord>("/profile");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function saveProfile(input: ProfileInput): Promise<ProfileRecord> {
  if (isMockMode) {
    return mockDelay({ ...input, bmi: computeBmi(input.weightKg ?? 70, input.heightCm ?? 170) });
  }
  return apiFetch<ProfileRecord>("/profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
