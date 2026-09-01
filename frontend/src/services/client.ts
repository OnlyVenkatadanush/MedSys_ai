const CONFIGURED_API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const API_BASE_URL = CONFIGURED_API_BASE_URL || "http://localhost:8000";

/** True only when VITE_API_BASE_URL was left unset — the one case where
 * there is no real backend to fail against, so mock data is a deliberate
 * standalone-demo mode rather than a mask over a real error. */
export const isMockMode = !CONFIGURED_API_BASE_URL;

export class ApiError extends Error {
  status?: number;
  detail?: string;
  constructor(message: string, status?: number, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

async function readErrorDetail(res: Response): Promise<string | undefined> {
  try {
    const body = await res.clone().json();
    return typeof body?.detail === "string" ? body.detail : undefined;
  } catch {
    return undefined;
  }
}

let getAuthToken: (() => Promise<string | null>) | null = null;
let currentRoleOverride: "doctor" | "patient" | null = null;

export function setAuthTokenGetter(getter: (() => Promise<string | null>) | null) {
  getAuthToken = getter;
}

export function setActiveRoleOverride(role: "doctor" | "patient" | null) {
  currentRoleOverride = role;
}

export function getActiveRoleOverride(): "doctor" | "patient" {
  return currentRoleOverride || (localStorage.getItem("medsys_role") as "doctor" | "patient") || "doctor";
}

/**
 * True only once the Demo Credentials form has actually been submitted —
 * distinct from `medsys_role`, which gets set as soon as you click a role
 * card on /select-role, before any real authentication has happened. This
 * is what ProtectedLayout checks to decide whether an unauthenticated
 * visitor gets in, so merely picking a role can't bypass sign-in.
 */
export function setDemoAuthenticated(value: boolean) {
  try {
    if (value) {
      localStorage.setItem("medsys_demo_authenticated", "true");
    } else {
      localStorage.removeItem("medsys_demo_authenticated");
    }
  } catch {}
}

export function isDemoAuthenticated(): boolean {
  try {
    return localStorage.getItem("medsys_demo_authenticated") === "true";
  } catch {
    return false;
  }
}

/**
 * A random id generated once per browser and persisted in localStorage.
 * Only used when there's no real Clerk session (demo mode): the backend
 * auto-provisions an isolated demo doctor/patient identity keyed by this id,
 * so two different demo browsers never collide on the same data the way the
 * old hardcoded doc_01/pat_01 fallback did.
 */
function getOrCreateDemoSessionId(): string {
  try {
    let id = localStorage.getItem("medsys_demo_session_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("medsys_demo_session_id", id);
    }
    return id;
  } catch {
    return "ephemeral-" + Math.random().toString(36).slice(2);
  }
}

/**
 * Builds the identity headers (Authorization + X-User-Role + X-Demo-Session-Id)
 * every request needs. Exported for the rare page that must use a raw
 * `fetch` instead of `apiFetch`/`apiUpload` — e.g. because it needs
 * `FormData`/multipart handling `apiFetch` doesn't support. Never hand-build
 * these headers (or a fake Authorization value) in a page component — that
 * bypasses real Clerk/demo identity resolution.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = getAuthToken ? await getAuthToken() : null;
  const activeRole = getActiveRoleOverride();
  const headers: Record<string, string> = {
    "X-User-Role": activeRole,
    "X-Demo-Session-Id": getOrCreateDemoSessionId(),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (isMockMode) {
    return getFallbackData<T>(path);
  }
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(`Request to ${path} failed`, res.status, await readErrorDetail(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  if (isMockMode) {
    return getFallbackData<T>(path);
  }
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      ...headers,
    },
    body: formData,
  });
  if (!res.ok) {
    throw new ApiError(`Upload to ${path} failed`, res.status, await readErrorDetail(res));
  }
  return res.json() as Promise<T>;
}

function getFallbackData<T>(path: string): T {
  if (path.includes("/command-center")) {
    return {
      total_patients: 124,
      todays_appointments_count: 8,
      pending_labs_count: 4,
      active_alerts_count: 3,
      priority_queue: [
        {
          id: "alt_01",
          patient_id: "pat_01",
          patient_name: "John Doe",
          doctor_id: "doc_01",
          type: "lab",
          severity: "critical",
          title: "New abnormal lab result",
          message: "Fasting Blood Glucose: 142 mg/dL (High)",
          is_read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "alt_02",
          patient_id: "pat_02",
          patient_name: "Emma Watson",
          doctor_id: "doc_01",
          type: "followup",
          severity: "important",
          title: "Follow-up consultation due",
          message: "Routine 30-day medication check",
          is_read: false,
          created_at: new Date().toISOString(),
        },
        {
          id: "alt_03",
          patient_id: "pat_03",
          patient_name: "Robert Chen",
          doctor_id: "doc_01",
          type: "adherence",
          severity: "attention",
          title: "Medication adherence dropped",
          message: "Missed 3 consecutive doses of Lisinopril",
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
      todays_appointments: [
        {
          id: "apt_c1",
          patient_id: "pat_01",
          doctor_id: "doc_01",
          patient_name: "John Doe",
          doctor_name: "Dr. Sarah Smith",
          date_time: "2026-08-28T10:00:00Z",
          reason: "Hypertension Follow-up & Lab Review",
          status: "confirmed",
          created_at: new Date().toISOString(),
        },
        {
          id: "apt_c2",
          patient_id: "pat_02",
          doctor_id: "doc_01",
          patient_name: "Emma Watson",
          doctor_name: "Dr. Sarah Smith",
          date_time: "2026-08-28T11:30:00Z",
          reason: "Routine Consultation & Vitals Check",
          status: "confirmed",
          created_at: new Date().toISOString(),
        },
      ],
    } as unknown as T;
  }

  if (path.includes("/patients")) {
    return [
      {
        id: "asgn_01",
        doctor_id: "doc_01",
        patient_id: "pat_01",
        patient_name: "John Doe",
        patient_age: 42,
        patient_gender: "Male",
        assigned_at: new Date().toISOString(),
        status: "active",
      },
      {
        id: "asgn_02",
        doctor_id: "doc_01",
        patient_id: "pat_02",
        patient_name: "Emma Watson",
        patient_age: 29,
        patient_gender: "Female",
        assigned_at: new Date().toISOString(),
        status: "active",
      },
      {
        id: "asgn_03",
        doctor_id: "doc_01",
        patient_id: "pat_03",
        patient_name: "Robert Chen",
        patient_age: 61,
        patient_gender: "Male",
        assigned_at: new Date().toISOString(),
        status: "active",
      },
    ] as unknown as T;
  }

  if (path.includes("/overview")) {
    return {
      patient_id: "pat_01",
      profile: {
        fullName: "John Doe",
        age: 42,
        bloodGroup: "O+",
        conditions: ["Mild Hypertension", "Early Pre-diabetes"],
        medications: [{ name: "Lisinopril", dosage: "10 mg" }, { name: "Metformin", dosage: "500 mg" }],
        emergencyContact: { name: "Jane Doe", relation: "Spouse", phone: "+1-555-0199" },
      },
      latest_diagnosis: "Mild Hypertension",
      adherence_rate: "86%",
      latest_vitals: { bp_systolic: 135, bp_diastolic: 85, heart_rate: 78, temperature_c: 38.2, spo2_pct: 98 },
    } as unknown as T;
  }

  if (path.includes("/pre-brief")) {
    return {
      patient_id: "pat_01",
      patient_name: "John Doe",
      age: 42,
      last_visit_date: "2026-08-12",
      main_concerns: ["Elevated Fasting Glucose (142 mg/dL)", "Decreased Lisinopril adherence"],
      trend_summary: "Fasting blood glucose up 22 points since last month; medication compliance down 12%.",
      suggested_discussion_topics: [
        "Discuss medication compliance strategies for Lisinopril",
        "Review dietary sugar intake and HbA1c target",
        "Evaluate need for dosage adjustment on Metformin",
      ],
    } as unknown as T;
  }

  if (path.includes("/lab-trends")) {
    return [
      {
        metric_name: "Fasting Glucose",
        unit: "mg/dL",
        history: [
          { date: "2026-06-01", value: 112.0, is_abnormal: false },
          { date: "2026-07-15", value: 128.0, is_abnormal: true },
          { date: "2026-08-25", value: 142.0, is_abnormal: true },
        ],
        trend_direction: "up",
      },
      {
        metric_name: "HbA1c",
        unit: "%",
        history: [
          { date: "2026-06-01", value: 6.1, is_abnormal: false },
          { date: "2026-07-15", value: 6.5, is_abnormal: true },
          { date: "2026-08-25", value: 7.2, is_abnormal: true },
        ],
        trend_direction: "up",
      },
      {
        metric_name: "Total Cholesterol",
        unit: "mg/dL",
        history: [
          { date: "2026-06-01", value: 210.0, is_abnormal: true },
          { date: "2026-07-15", value: 198.0, is_abnormal: false },
          { date: "2026-08-25", value: 190.0, is_abnormal: false },
        ],
        trend_direction: "down",
      },
    ] as unknown as T;
  }

  return {} as T;
}

export function mockDelay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
