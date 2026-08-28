export type UserRole = "patient" | "doctor" | "admin";

export interface UserRecord {
  id: string;
  clerk_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  created_at: string;
}

export interface DoctorPatientAssignment {
  id: string;
  doctor_id: string;
  patient_id: string;
  patient_name: string;
  patient_age: number;
  patient_gender?: string;
  assigned_at: string;
  status: "active" | "archived";
}

export interface Vitals {
  bp_systolic?: number;
  bp_diastolic?: number;
  heart_rate?: number;
  temperature_c?: number;
  spo2_pct?: number;
}

export interface PrescriptionItem {
  medication_name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions?: string;
}

export interface AISuggestions {
  differential_diagnoses: string[];
  drug_interaction_warnings: string[];
  suggested_prescriptions: PrescriptionItem[];
  clinical_summary: string;
  suggested_diet: string[];
  urgency_level: "routine" | "moderate" | "critical";
}

export interface ConsultationSession {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name: string;
  patient_name: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "finalized" | "archived";
  symptoms: string[];
  vitals?: Vitals;
  ai_suggestions?: AISuggestions;
  doctor_diagnosis?: string;
  prescriptions: PrescriptionItem[];
  doctor_notes?: string;
  diet_recommendations: string[];
  follow_up_date?: string;
  signed_off_at?: string;
}

export interface MedicationSchedule {
  id: string;
  patient_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  times_per_day: number;
  start_date: string;
  active: boolean;
  prescribed_by_doctor_id: string;
}

export interface MedicationLogRecord {
  id: string;
  patient_id: string;
  medication_id: string;
  medication_name: string;
  dosage: string;
  timestamp: string;
  status: "taken" | "skipped";
}

export interface MealLogRecord {
  id: string;
  patient_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  food_items: string[];
  timestamp: string;
  notes?: string;
}

export interface DietPlan {
  id: string;
  patient_id: string;
  doctor_id: string;
  guidelines: string;
  allowed_foods: string[];
  restricted_foods: string[];
  updated_at: string;
}

export interface LabMetric {
  name: string;
  value: number;
  unit: string;
  reference_range: string;
  is_abnormal: boolean;
}

export interface LabReportRecord {
  id: string;
  patient_id: string;
  uploaded_by: string;
  title: string;
  file_url?: string;
  extracted_text: string;
  metrics: LabMetric[];
  uploaded_at: string;
}

export interface AppointmentRecord {
  id: string;
  patient_id: string;
  doctor_id: string;
  patient_name: string;
  doctor_name: string;
  date_time: string;
  reason: string;
  status: "requested" | "confirmed" | "completed" | "cancelled";
  created_at: string;
}

export interface AlertRecord {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  type: "vital" | "lab" | "adherence" | "symptom" | "followup";
  severity: "info" | "attention" | "important" | "critical";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  timestamp: string;
  actor_id: string;
  actor_role: UserRole;
  action: string;
  target_patient_id: string;
  resource: string;
  details?: string;
}

export interface CommandCenterData {
  total_patients: number;
  todays_appointments_count: number;
  pending_labs_count: number;
  active_alerts_count: number;
  priority_queue: AlertRecord[];
  todays_appointments: AppointmentRecord[];
}

export interface WhatsNewChanges {
  patient_id: string;
  last_visit_date: string;
  current_date: string;
  metrics_changes: Array<{
    metric: string;
    previous: string;
    current: string;
    direction: "up" | "down" | "flat";
    is_abnormal: boolean;
  }>;
  events_since_last_visit: string[];
  attention_items_count: number;
}

export interface EvidenceTrace {
  insight_id: string;
  patient_id: string;
  title: string;
  evidence_sources: string[];
  relevant_changes: string[];
}

export interface StructuredVoiceNoteOut {
  chief_complaint: string;
  symptoms: string[];
  duration: string;
  observations: string;
  doctor_notes: string;
}

export interface DoctorAnalytics {
  total_assigned_patients: number;
  consultations_this_week: number;
  pending_lab_reviews: number;
  upcoming_appointments: number;
  overall_adherence_rate: string;
  weekly_consultation_velocity: Array<{ day: string; count: number }>;
}

export interface PatientComparisonCard {
  patient_id: string;
  name: string;
  age: number;
  gender: string;
  blood_group: string;
  primary_diagnosis: string;
  adherence_rate: string;
  latest_bp: string;
  latest_glucose: string;
  status: "stable" | "attention" | "critical";
}

export interface MultiPatientCompareResult {
  patients: PatientComparisonCard[];
  comparison_summary: string;
}

export type ChatSourceKind = "doc" | "web" | "system" | "report" | "consultation";

export interface ChatSourceDetail {
  title?: string;
  url?: string;
  snippet?: string;
  content?: string;
  kind?: ChatSourceKind;
  id?: string;
  label?: string;
  details?: any;
}

export interface ChatSource {
  kind: ChatSourceKind;
  id: string;
  label?: string;
  title?: string;
  uploadedAt?: string;
  excerpt?: string;
  details?: ChatSourceDetail;
}

export interface ChatMessage {
  id: string;
  session_id?: string;
  sender?: "user" | "assistant";
  role?: "user" | "assistant";
  message?: string;
  content?: string;
  sources?: ChatSource[];
  created_at?: string;
  createdAt?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  sourceIds?: string[];
}

export type FacilityType = "hospital" | "clinic" | "pharmacy" | "diagnostic_center";

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  address: string;
  phone: string;
  specialty?: string;
  lat?: number;
  lng?: number;
  distance_km?: number;
  distanceKm?: number;
}

export interface HomeSnapshot {
  user_name: string;
  role: string;
  upcoming_appointments_count: number;
  active_alerts_count: number;
  recent_activities: string[];
  status?: string;
  statusNote?: string;
  environment?: string;
  tip?: string;
  generalTip?: string;
  graph?: any;
}

export interface ModelStatus {
  status: "online" | "offline" | "degraded";
  active_model: string;
  provider?: string;
}

export interface ProfileRecord {
  id: string;
  userId: string;
  fullName: string;
  age?: number;
  weightKg?: number;
  heightCm?: number;
  bmi?: number;
  bloodGroup?: string;
  conditions: string[];
  medications: Array<{ name: string; dosage: string }>;
  emergencyContact?: { name: string; relation: string; phone: string };
}
