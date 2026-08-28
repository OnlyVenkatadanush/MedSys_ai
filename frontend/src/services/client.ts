const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

/** True when no backend base URL is configured — UI runs on mock data. */
export const isMockMode = !API_BASE_URL;

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

async function authHeaders(): Promise<Record<string, string>> {
  const token = getAuthToken ? await getAuthToken() : null;
  const activeRole = getActiveRoleOverride();
  const headers: Record<string, string> = {
    "X-User-Role": activeRole,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiError("VITE_API_BASE_URL is not configured");
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
  if (!API_BASE_URL) {
    throw new ApiError("VITE_API_BASE_URL is not configured");
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
    throw new ApiError(`Upload to ${path} failed`, res.status);
  }
  return res.json() as Promise<T>;
}

export function mockDelay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
