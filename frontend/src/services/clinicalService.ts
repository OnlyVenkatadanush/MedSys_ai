import { apiFetch, apiUpload } from "./client";
import type {
  AlertRecord,
  AppointmentRecord,
  CommandCenterData,
  ConsultationSession,
  DoctorAnalytics,
  DoctorPatientAssignment,
  EvidenceTrace,
  LabMetricTrend,
  LabReportRecord,
  MedicationLogRecord,
  MedicationSchedule,
  MultiPatientCompareResult,
  PatientClarificationMessage,
  PreConsultationBrief,
  PrescriptionItem,
  StructuredVoiceNoteOut,
  Vitals,
  WhatsNewChanges,
} from "@/types";

/* ==================== DOCTOR APIS ==================== */

export async function fetchCommandCenter(): Promise<CommandCenterData> {
  return apiFetch<CommandCenterData>("/api/doctor/command-center");
}

export async function fetchWhatsNew(patientId: string): Promise<WhatsNewChanges> {
  return apiFetch<WhatsNewChanges>(`/api/doctor/patient/${patientId}/whats-new`);
}

export async function fetchEvidenceTrace(patientId: string, insightId = "insight_01"): Promise<EvidenceTrace> {
  return apiFetch<EvidenceTrace>(`/api/doctor/patient/${patientId}/evidence?insight_id=${insightId}`);
}

export async function parseVoiceNotes(rawSpeechText: string): Promise<StructuredVoiceNoteOut> {
  return apiFetch<StructuredVoiceNoteOut>("/api/doctor/voice-parse", {
    method: "POST",
    body: JSON.stringify({ raw_speech_text: rawSpeechText }),
  });
}

export async function fetchDoctorAnalytics(): Promise<DoctorAnalytics> {
  return apiFetch<DoctorAnalytics>("/api/doctor/analytics");
}

export async function fetchMultiPatientCompare(): Promise<MultiPatientCompareResult> {
  return apiFetch<MultiPatientCompareResult>("/api/doctor/compare");
}

export async function fetchAssignedPatients(): Promise<DoctorPatientAssignment[]> {
  return apiFetch<DoctorPatientAssignment[]>("/api/doctor/patients");
}

export async function searchPatients(query: string): Promise<DoctorPatientAssignment[]> {
  return apiFetch<DoctorPatientAssignment[]>(`/api/doctor/patients/search?q=${encodeURIComponent(query)}`);
}

export async function linkExistingPatient(identifier: string): Promise<DoctorPatientAssignment> {
  return apiFetch<DoctorPatientAssignment>("/api/doctor/patients/link", {
    method: "POST",
    body: JSON.stringify({ identifier }),
  });
}

export async function fetchPatientOverview(patientId: string) {
  return apiFetch<{
    patient_id: string;
    profile: any;
    latest_diagnosis: string | null;
    adherence_rate: string | null;
    latest_vitals: Vitals | null;
    next_appointment_date: string | null;
  }>(`/api/doctor/patient/${patientId}/overview`);
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

export async function fetchTimelineAnalysis(patientId: string): Promise<{ patient_id: string; analysis: string }> {
  return apiFetch<{ patient_id: string; analysis: string }>(`/api/doctor/patient/${patientId}/timeline-analysis`);
}

export async function fetchPreConsultationBrief(patientId: string): Promise<PreConsultationBrief> {
  return apiFetch<PreConsultationBrief>(`/api/doctor/patient/${patientId}/pre-brief`);
}

export async function fetchLabTrends(patientId: string): Promise<LabMetricTrend[]> {
  return apiFetch<LabMetricTrend[]>(`/api/doctor/patient/${patientId}/lab-trends`);
}

export async function sendDoctorCopilotQuery(patientId: string, message: string): Promise<{ patient_id: string; patient_name: string; reply: string }> {
  return apiFetch<{ patient_id: string; patient_name: string; reply: string }>("/api/doctor/copilot/chat", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, message }),
  });
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
    doctor_confirmation?: boolean;
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

export interface TimeSlot {
  time: string;
  status: "available" | "busy";
  appointment_id?: string;
}

export interface DoctorAvailabilityData {
  doctor_id: string;
  doctor_name: string;
  date: string;
  slots: TimeSlot[];
}

export async function fetchDoctorAvailability(doctorId = "doc_01", date = "2026-09-05"): Promise<DoctorAvailabilityData> {
  return apiFetch<DoctorAvailabilityData>(`/api/appointments/availability?doctor_id=${doctorId}&date=${date}`);
}

export async function requestPatientAppointment(payload: {
  doctor_id: string;
  appointment_date: string;
  reason: string;
  notes?: string;
}): Promise<AppointmentRecord> {
  return apiFetch<AppointmentRecord>("/api/appointments/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchDoctorAppointments(statusFilter?: string): Promise<AppointmentRecord[]> {
  const url = statusFilter
    ? `/api/appointments/doctor-queue?status_filter=${encodeURIComponent(statusFilter)}`
    : "/api/appointments/doctor-queue";
  return apiFetch<AppointmentRecord[]>(url);
}

export async function fetchPatientAppointments(): Promise<AppointmentRecord[]> {
  return apiFetch<AppointmentRecord[]>("/api/appointments/patient-queue");
}

export async function processAppointmentAction(
  appointmentId: string,
  action: "confirm" | "decline" | "complete" | "cancel",
  notes = ""
): Promise<AppointmentRecord> {
  return apiFetch<AppointmentRecord>(`/api/appointments/${appointmentId}/action`, {
    method: "POST",
    body: JSON.stringify({ action, notes }),
  });
}

export async function fetchAppointments(): Promise<AppointmentRecord[]> {
  return apiFetch<AppointmentRecord[]>("/api/appointments/patient-queue");
}

export async function requestAppointment(payload: {
  doctor_id: string;
  date_time: string;
  reason: string;
}): Promise<AppointmentRecord> {
  return requestPatientAppointment({
    doctor_id: payload.doctor_id,
    appointment_date: payload.date_time,
    reason: payload.reason,
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
