import { apiFetch, apiUpload } from "./client";
import type {
  AppointmentRecord,
  ConsultationSession,
  DoctorPatientAssignment,
  LabReportRecord,
  MedicationLogRecord,
  MedicationSchedule,
  PatientClarificationMessage,
  PrescriptionItem,
  Vitals,
} from "@/types";

/* ==================== DOCTOR APIS ==================== */

export async function fetchAssignedPatients(): Promise<DoctorPatientAssignment[]> {
  return apiFetch<DoctorPatientAssignment[]>("/api/doctor/patients");
}

export async function fetchPatientTimeline(patientId: string) {
  return apiFetch<{
    patient_id: string;
    profile: any;
    consultations: ConsultationSession[];
    lab_reports: LabReportRecord[];
    active_medications: MedicationSchedule[];
  }>(`/api/doctor/patient/${patientId}/timeline`);
}

export async function createConsultation(payload: {
  patient_id: string;
  symptoms: string[];
  vitals?: Vitals;
  doctor_notes?: string;
}): Promise<ConsultationSession> {
  return apiFetch<ConsultationSession>("/api/doctor/consultations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function triggerAIDecisionSupport(sessionId: string): Promise<ConsultationSession> {
  return apiFetch<ConsultationSession>(`/api/doctor/consultations/${sessionId}/ai-assist`, {
    method: "POST",
  });
}

export async function finalizeConsultation(
  sessionId: string,
  payload: {
    doctor_diagnosis: string;
    prescriptions: PrescriptionItem[];
    doctor_notes: string;
    diet_recommendations: string[];
    follow_up_date?: string;
  }
): Promise<ConsultationSession> {
  return apiFetch<ConsultationSession>(`/api/doctor/consultations/${sessionId}/finalize`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ==================== PATIENT APIS ==================== */

export async function fetchPatientDashboard() {
  return apiFetch<{
    patient_id: string;
    recent_doctor_advice: ConsultationSession[];
    active_medications: MedicationSchedule[];
    medication_logs: MedicationLogRecord[];
    diet_plan: any;
  }>("/api/patient/dashboard");
}

export async function fetchPatientMedications() {
  return apiFetch<{ schedules: MedicationSchedule[]; logs: MedicationLogRecord[] }>("/api/patient/medications");
}

export async function logMedicationDose(payload: {
  medication_id: string;
  medication_name: string;
  dosage: string;
  status: "taken" | "skipped";
  notes?: string;
}): Promise<MedicationLogRecord> {
  return apiFetch<MedicationLogRecord>("/api/patient/medications/log", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchPatientDiet() {
  return apiFetch<{ diet_plan: any; meal_logs: any[] }>("/api/patient/diet");
}

export async function logPatientMeal(payload: {
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  food_items: string[];
  notes?: string;
}) {
  return apiFetch("/api/patient/diet/meals", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendPatientClarificationChat(message: string): Promise<PatientClarificationMessage> {
  return apiFetch<PatientClarificationMessage>("/api/patient/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

/* ==================== APPOINTMENTS & DOCUMENTS ==================== */

export async function fetchAppointments(): Promise<AppointmentRecord[]> {
  return apiFetch<AppointmentRecord[]>("/api/appointments");
}

export async function requestAppointment(payload: {
  doctor_id: string;
  date_time: string;
  reason: string;
}): Promise<AppointmentRecord> {
  return apiFetch<AppointmentRecord>("/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchLabReports(patientId = "pat_01"): Promise<LabReportRecord[]> {
  return apiFetch<LabReportRecord[]>(`/api/documents/lab-reports?patient_id=${patientId}`);
}

export async function uploadLabReport(title: string, patientId: string, file: File): Promise<LabReportRecord> {
  const formData = new FormData();
  formData.append("title", title);
  formData.append("patient_id", patientId);
  formData.append("file", file);
  return apiUpload<LabReportRecord>("/api/documents/upload", formData);
}
