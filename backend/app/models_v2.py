from datetime import datetime
from typing import Literal, Optional, Any
from pydantic import BaseModel, Field

UserRole = Literal["patient", "doctor", "admin"]


class UserRecord(BaseModel):
    id: str
    clerk_id: str
    email: str
    full_name: str
    role: UserRole
    created_at: str


class DoctorPatientAssignment(BaseModel):
    id: str
    doctor_id: str
    patient_id: str
    patient_name: str
    patient_age: int
    patient_gender: Optional[str] = None
    assigned_at: str
    status: Literal["active", "archived"] = "active"


class Vitals(BaseModel):
    bp_systolic: Optional[int] = None
    bp_diastolic: Optional[int] = None
    heart_rate: Optional[int] = None
    temperature_c: Optional[float] = None
    spo2_pct: Optional[int] = None


class PrescriptionItem(BaseModel):
    medication_name: str
    dosage: str
    frequency: str  # e.g., "Twice daily after meals"
    duration_days: int
    instructions: Optional[str] = None


class AISuggestions(BaseModel):
    differential_diagnoses: list[str] = []
    drug_interaction_warnings: list[str] = []
    suggested_prescriptions: list[PrescriptionItem] = []
    clinical_summary: str = ""
    suggested_diet: list[str] = []
    urgency_level: Literal["routine", "moderate", "critical"] = "routine"


class ConsultationSession(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    doctor_name: Optional[str] = None
    patient_name: Optional[str] = None
    created_at: str
    updated_at: str
    status: Literal["draft", "finalized"] = "draft"
    symptoms: list[str] = []
    vitals: Optional[Vitals] = None
    ai_suggestions: Optional[AISuggestions] = None
    doctor_diagnosis: str = ""
    prescriptions: list[PrescriptionItem] = []
    doctor_notes: str = ""
    diet_recommendations: list[str] = []
    follow_up_date: Optional[str] = None
    signed_off_at: Optional[str] = None


class ConsultationCreateIn(BaseModel):
    patient_id: str
    symptoms: list[str] = []
    vitals: Optional[Vitals] = None
    doctor_notes: Optional[str] = None


class ConsultationFinalizeIn(BaseModel):
    doctor_diagnosis: str
    prescriptions: list[PrescriptionItem] = []
    doctor_notes: str = ""
    diet_recommendations: list[str] = []
    follow_up_date: Optional[str] = None
    doctor_confirmation: bool = True  # Confirming review & clinical judgment


class MedicationSchedule(BaseModel):
    id: str
    patient_id: str
    medication_name: str
    dosage: str
    frequency: str
    times_per_day: int = 1
    start_date: str
    end_date: Optional[str] = None
    active: bool = True
    prescribed_by_doctor_id: Optional[str] = None


class MedicationLogIn(BaseModel):
    medication_id: str
    medication_name: str
    dosage: str
    status: Literal["taken", "skipped"] = "taken"
    notes: Optional[str] = None


class MedicationLogRecord(BaseModel):
    id: str
    patient_id: str
    medication_id: str
    medication_name: str
    dosage: str
    timestamp: str
    status: Literal["taken", "skipped"]
    notes: Optional[str] = None


class DietPlan(BaseModel):
    id: str
    patient_id: str
    doctor_id: Optional[str] = None
    guidelines: str
    allowed_foods: list[str] = []
    restricted_foods: list[str] = []
    updated_at: str


class MealLogIn(BaseModel):
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    food_items: list[str]
    notes: Optional[str] = None


class MealLogRecord(BaseModel):
    id: str
    patient_id: str
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"]
    food_items: list[str]
    timestamp: str
    notes: Optional[str] = None


class LabMetric(BaseModel):
    name: str
    value: float
    unit: str
    reference_range: Optional[str] = None
    is_abnormal: bool = False


class LabReportRecord(BaseModel):
    id: str
    patient_id: str
    uploaded_by: str
    title: str
    file_url: Optional[str] = None
    extracted_text: str = ""
    metrics: list[LabMetric] = []
    uploaded_at: str


class AppointmentCreateIn(BaseModel):
    doctor_id: str
    date_time: str
    reason: str


class AppointmentRecord(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    patient_name: str
    doctor_name: str
    date_time: str
    reason: str
    status: Literal["requested", "confirmed", "completed", "cancelled"] = "requested"
    created_at: str


class AuditLogRecord(BaseModel):
    id: str
    timestamp: str
    actor_id: str
    actor_role: str
    action: str
    target_patient_id: str
    resource: str
    details: Optional[str] = None


class PatientClarificationMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    created_at: str
    is_red_flag: bool = False
    emergency_guidance: Optional[str] = None


# ==================== DOCTOR COMMAND CENTER & CLINICAL COPILOT SCHEMAS ====================

class AlertRecord(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    doctor_id: str
    type: Literal["lab", "adherence", "followup", "vitals"]
    severity: Literal["critical", "important", "attention", "info"] = "attention"
    title: str
    message: str
    is_read: bool = False
    created_at: str


class MetricHistoryPoint(BaseModel):
    date: str
    value: float
    is_abnormal: bool = False


class LabMetricTrend(BaseModel):
    metric_name: str
    unit: str
    history: list[MetricHistoryPoint] = []
    trend_direction: Literal["up", "down", "stable"] = "stable"


class PreConsultationBrief(BaseModel):
    patient_id: str
    patient_name: str
    age: int
    last_visit_date: str
    main_concerns: list[str] = []
    trend_summary: str
    suggested_discussion_topics: list[str] = []


class CommandCenterData(BaseModel):
    total_patients: int
    todays_appointments_count: int
    pending_labs_count: int
    active_alerts_count: int
    priority_queue: list[AlertRecord] = []
    todays_appointments: list[AppointmentRecord] = []


class CopilotChatIn(BaseModel):
    patient_id: Optional[str] = None
    message: str


# ==================== V1.5 & V2 ADVANCED DOCTOR SCHEMAS ====================

class MetricChangeItem(BaseModel):
    metric: str
    previous: str
    current: str
    direction: Literal["up", "down", "stable"]
    is_abnormal: bool = False


class WhatsNewChanges(BaseModel):
    patient_id: str
    last_visit_date: str
    current_date: str
    metrics_changes: list[MetricChangeItem] = []
    events_since_last_visit: list[str] = []
    attention_items_count: int = 0


class EvidenceTrace(BaseModel):
    insight_id: str
    patient_id: str
    title: str
    evidence_sources: list[str] = []
    relevant_changes: list[str] = []


class VoiceParseIn(BaseModel):
    raw_speech_text: str


class StructuredVoiceNoteOut(BaseModel):
    chief_complaint: str
    symptoms: list[str] = []
    duration: str
    observations: str
    doctor_notes: str


class DoctorAnalytics(BaseModel):
    total_assigned_patients: int
    consultations_this_week: int
    pending_lab_reviews: int
    upcoming_appointments: int
    overall_adherence_rate: str
    weekly_consultation_velocity: list[dict] = []


class PatientComparisonCard(BaseModel):
    patient_id: str
    name: str
    age: int
    gender: str
    blood_group: str
    primary_diagnosis: str
    adherence_rate: str
    latest_bp: str
    latest_glucose: str
    status: Literal["stable", "attention", "critical"]


class MultiPatientCompareResult(BaseModel):
    patients: list[PatientComparisonCard] = []
    comparison_summary: str
