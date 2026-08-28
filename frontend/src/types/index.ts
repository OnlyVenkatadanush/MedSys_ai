export type SystemStatus = "stable" | "moderate" | "serious";

export interface PollutantReading {
  label: string;
  value: number;
  unit: string;
}

export interface EnvironmentSnapshot {
  locationName: string;
  tempC: number;
  condition: string;
  humidityPct: number;
  aqi: number;
  aqiCategory: string;
  pollutants: PollutantReading[];
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  date: string;
  description?: string;
  category?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  durationDays: number;
  relation?: string;
  rationale?: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface HomeSnapshot {
  status: SystemStatus;
  statusNote: string;
  environment: EnvironmentSnapshot;
  tip: string;
  generalTip: string;
  graph: KnowledgeGraph;
}

export type ChatSourceKind =
  | "consultation"
  | "consult_prescription"
  | "prescription"
  | "report"
  | "web";

export interface ChatSource {
  id: string;
  title: string;
  kind: ChatSourceKind;
  uploadedAt: string;
  excerpt: string;
  url?: string;
}

export interface ChatSourceDetail extends ChatSource {
  content: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  sourceIds: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  isRedFlag?: boolean;
  quickOptions?: string[];
}

export interface ModelStatus {
  provider: "ollama" | "groq" | "gemini";
  model: string;
  reachable: boolean;
}

export type FacilityType = "hospital" | "clinic" | "diagnostic_center";

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  specialty: string;
  address: string;
  distanceKm: number;
  lat: number;
  lng: number;
  openNow: boolean;
  phone?: string;
}

export interface ProfileRecord {
  fullName: string;
  age: number;
  weightKg: number;
  heightCm: number;
  bmi: number;
  bloodGroup: string;
  conditions: string[];
  medications: { name: string; dosage: string }[];
  emergencyContact: { name: string; relation: string; phone: string };
}

/* ==================== MEDSYS AI 2.0 MULTI-TENANT TYPES ==================== */

export type UserRole = "patient" | "doctor" | "admin";

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
  doctor_name?: string;
  patient_name?: string;
  created_at: string;
  updated_at: string;
  status: "draft" | "finalized";
  symptoms: string[];
  vitals?: Vitals;
  ai_suggestions?: AISuggestions;
  doctor_diagnosis: string;
  prescriptions: PrescriptionItem[];
  doctor_notes: string;
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
  end_date?: string;
  active: boolean;
  prescribed_by_doctor_id?: string;
}

export interface MedicationLogRecord {
  id: string;
  patient_id: string;
  medication_id: string;
  medication_name: string;
  dosage: string;
  timestamp: string;
  status: "taken" | "skipped";
  notes?: string;
}

export interface DietPlan {
  id?: string;
  patient_id: string;
  doctor_id?: string;
  guidelines: string;
  allowed_foods: string[];
  restricted_foods: string[];
  updated_at?: string;
}

export interface MealLogRecord {
  id: string;
  patient_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  food_items: string[];
  timestamp: string;
  notes?: string;
}

export interface LabMetric {
  name: string;
  value: number;
  unit: string;
  reference_range?: string;
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

export interface PatientClarificationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  is_red_flag?: boolean;
  emergency_guidance?: string;
}
