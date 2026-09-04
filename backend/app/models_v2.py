"""Pydantic V2 Schemas for MedSys AI 2.0.

Contains all models for Doctor Registration, 4-Step Patient Onboarding Wizard, Patient Account Activation,
Command Center, Patient Workspace, Lab Intelligence, Voice Parsing, Analytics, Multi-Patient Comparison,
Appointments, Medication Logs, Meal Logs, Diet Plans, Patient Chat, Audit Logs, and AI Decision Support.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field

UserRole = Literal["doctor", "patient"]


# ==================== AUDIT LOG SCHEMA ====================

class AuditLogRecord(BaseModel):
    id: str
    timestamp: str
    actor_id: str
    actor_role: str
    action: str
    target_patient_id: str
    resource: str
    details: Optional[str] = None


# ==================== CLINICAL VITALS & AI SUGGESTIONS SCHEMAS ====================

class Vitals(BaseModel):
    bp_systolic: Optional[int] = 120
    bp_diastolic: Optional[int] = 80
    heart_rate: Optional[int] = 72
    temperature_c: Optional[float] = 37.0
    spo2_pct: Optional[int] = 98


class PrescriptionItem(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    duration_days: int = 7
    instructions: Optional[str] = ""


class AISuggestions(BaseModel):
    clinical_summary: str = ""
    differential_diagnoses: List[str] = []
    drug_interaction_warnings: List[str] = []
    suggested_prescriptions: List[PrescriptionItem] = []
    suggested_lifestyle_advice: List[str] = []
    urgency_level: str = "routine"


# ==================== ONBOARDING & ACCOUNT LIFECYCLE SCHEMAS ====================

class DoctorRegistrationIn(BaseModel):
    full_name: str = Field(..., min_length=2, example="Dr. Sarah Smith")
    email: str = Field(..., example="dr.smith@medsys.ai")
    phone: str = Field(..., example="+1-555-0100")
    specialization: str = Field("General Practice", example="Cardiology & Internal Medicine")
    license_number: str = Field(..., example="MD-994821")
    hospital_name: Optional[str] = Field("St. Jude Medical Center")
    experience_years: Optional[int] = Field(10)


class PatientSelfRegistrationIn(BaseModel):
    """Self-serve patient registration — filled in on first login, unlike
    the doctor-driven add_patient_wizard which invites a patient by email."""
    full_name: str = Field(..., min_length=2, example="John Doe")
    email: str = Field(..., example="john.doe@example.com")
    dob: str = Field(..., example="1990-01-15")
    gender: str = Field("Male", example="Male")
    blood_group: str = Field("O+", example="O+")
    height_cm: Optional[float] = Field(170.0)
    weight_kg: Optional[float] = Field(70.0)
    phone: Optional[str] = ""
    emergency_contact_name: Optional[str] = ""
    emergency_contact_phone: Optional[str] = ""


class PatientWizardStep1Identity(BaseModel):
    first_name: str = Field(..., example="John")
    last_name: str = Field(..., example="Doe")
    dob: str = Field(..., example="1984-05-12")
    gender: str = Field("Male", example="Male")
    phone: str = Field(..., example="+1-555-0123")
    email: str = Field(..., example="john.doe@example.com")
    height_cm: Optional[float] = Field(178.0, example=178.0)
    weight_kg: Optional[float] = Field(75.0, example=75.0)


class PatientWizardStep2Medical(BaseModel):
    blood_group: str = Field("O+", example="O+")
    allergies: List[Dict[str, str]] = Field(default_factory=list, example=[{"allergen": "Penicillin", "severity": "severe"}])
    conditions: List[Dict[str, str]] = Field(default_factory=list, example=[{"condition_name": "Mild Hypertension"}])
    emergency_contact_name: Optional[str] = Field("Jane Doe")
    emergency_contact_phone: Optional[str] = Field("+1-555-0199")


class PatientWizardStep3Clinical(BaseModel):
    registration_reason: Optional[str] = Field("Initial routine intake & blood pressure monitoring")
    initial_symptoms: Optional[str] = Field("Occasional mild headache")
    initial_doctor_notes: Optional[str] = Field("Patient onboarding notes recorded by doctor")


class PatientWizardCreateIn(BaseModel):
    identity: PatientWizardStep1Identity
    medical: PatientWizardStep2Medical
    clinical: Optional[PatientWizardStep3Clinical] = None


class PatientWizardOut(BaseModel):
    patient_id: str
    patient_id_code: str
    name: str
    email: str
    account_state: str
    message: str


class PatientActivationIn(BaseModel):
    invitation_token: str


# ==================== APPOINTMENT SCHEMAS ====================

class AppointmentCreateIn(BaseModel):
    doctor_id: Optional[str] = "doc_01"
    appointment_date: str = Field(..., example="2026-09-05T10:00:00Z")
    reason: str = Field(..., example="Routine Follow-up & Blood Pressure Check")
    notes: Optional[str] = ""


class AppointmentRecord(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    patient_name: str
    doctor_name: str
    appointment_date: str
    reason: str
    status: str
    notes: Optional[str] = ""
    created_at: str


# ==================== PATIENT PORTAL SCHEMAS ====================

class MedicationSchedule(BaseModel):
    id: str
    patient_id: str
    medication_name: str
    dosage: str
    frequency: str
    times_per_day: int
    start_date: str
    active: bool
    prescribed_by_doctor_id: str


class MedicationLogIn(BaseModel):
    medication_id: str
    medication_name: str
    dosage: str
    status: str = "taken"
    notes: Optional[str] = ""


class MedicationLogRecord(BaseModel):
    id: str
    patient_id: str
    medication_id: str
    medication_name: str
    dosage: str
    timestamp: str
    status: str
    notes: Optional[str] = ""


class MealLogIn(BaseModel):
    meal_type: str
    food_items: List[str]
    notes: Optional[str] = ""


class MealLogRecord(BaseModel):
    id: str
    patient_id: str
    meal_type: str
    food_items: List[str]
    timestamp: str
    notes: Optional[str] = ""


class DietPlan(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    guidelines: str
    allowed_foods: List[str]
    restricted_foods: List[str]
    updated_at: str


class PatientClarificationMessage(BaseModel):
    id: str
    session_id: str
    sender: str
    message: str
    created_at: str


# ==================== CLINICAL WORKSPACE & COMMAND CENTER SCHEMAS ====================

class AlertRecord(BaseModel):
    id: str
    patient_id: str
    patient_name: str
    doctor_id: str
    type: str
    severity: str
    title: str
    message: str
    is_read: bool = False
    created_at: str


class DoctorPatientAssignment(BaseModel):
    id: str
    doctor_id: str
    patient_id: str
    patient_name: str
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    assigned_at: str
    status: str


class WhatsNewChanges(BaseModel):
    patient_id: str
    last_visit_date: Optional[str] = None
    current_date: str
    metrics_changes: List[Dict[str, Any]]
    events_since_last_visit: List[str]
    attention_items_count: int


class EvidenceTrace(BaseModel):
    insight_id: str
    patient_id: str
    title: str
    evidence_sources: List[str]
    relevant_changes: List[str]


class LinkExistingPatientIn(BaseModel):
    """Identifies an already-registered patient to add to a doctor's panel —
    either their account email or their PAT-XXXXXX Patient ID code."""
    identifier: str = Field(..., min_length=3, example="john.doe@example.com")


class VoiceParseIn(BaseModel):
    raw_speech_text: str


class StructuredVoiceNoteOut(BaseModel):
    chief_complaint: str
    symptoms: List[str]
    duration: str
    observations: str
    doctor_notes: str


class DoctorAnalytics(BaseModel):
    total_assigned_patients: int
    consultations_this_week: int
    pending_lab_reviews: int
    upcoming_appointments: int
    overall_adherence_rate: str
    weekly_consultation_velocity: List[Dict[str, Any]]
    patient_risk_distribution: List[Dict[str, Any]] = []
    top_chronic_conditions: List[Dict[str, Any]] = []
    adherence_breakdown: List[Dict[str, Any]] = []
    age_demographics: List[Dict[str, Any]] = []
    alert_severity_breakdown: List[Dict[str, Any]] = []


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
    status: str


class MultiPatientCompareResult(BaseModel):
    patients: List[PatientComparisonCard]
    comparison_summary: str


class LabMetric(BaseModel):
    name: str
    value: float
    unit: str
    reference_range: str
    is_abnormal: bool


class LabReportRecord(BaseModel):
    id: str
    patient_id: str
    uploaded_by: str
    title: str
    file_url: Optional[str] = ""
    extracted_text: str
    metrics: List[LabMetric]
    uploaded_at: str


class MetricHistoryPoint(BaseModel):
    date: str
    value: float
    is_abnormal: bool


class LabMetricTrend(BaseModel):
    metric_name: str
    unit: str
    history: List[MetricHistoryPoint]
    trend_direction: str


class PreConsultationBrief(BaseModel):
    patient_id: str
    patient_name: str
    age: Optional[int] = None
    last_visit_date: Optional[str] = None
    main_concerns: List[str]
    trend_summary: str
    suggested_discussion_topics: List[str]


class CommandCenterData(BaseModel):
    total_patients: int
    total_consultations: int
    todays_appointments_count: int
    pending_labs_count: int
    active_alerts_count: int
    priority_queue: List[AlertRecord]
    todays_appointments: List[AppointmentRecord]


class VitalsIn(BaseModel):
    systolic_bp: int = 120
    diastolic_bp: int = 80
    heart_rate: int = 72
    temperature_c: float = 37.0
    spo2_pct: int = 98


class PrescriptionIn(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    duration_days: int = 7
    instructions: str = ""


class ConsultationCreateIn(BaseModel):
    patient_id: str
    symptoms: List[str]
    vitals: Optional[VitalsIn] = None
    doctor_notes: Optional[str] = ""


class ConsultationFinalizeIn(BaseModel):
    doctor_diagnosis: str
    prescriptions: List[PrescriptionIn]
    doctor_notes: str
    diet_recommendations: List[str] = []
    follow_up_date: Optional[str] = None


class ConsultationSession(BaseModel):
    id: str
    patient_id: str
    doctor_id: str
    doctor_name: str
    patient_name: str
    created_at: str
    updated_at: str
    status: str
    symptoms: List[str]
    vitals: Optional[VitalsIn] = None
    ai_suggestions: Optional[Any] = None
    doctor_diagnosis: Optional[str] = None
    prescriptions: List[PrescriptionIn] = []
    doctor_notes: Optional[str] = None
    diet_recommendations: List[str] = []
    follow_up_date: Optional[str] = None
    signed_off_at: Optional[str] = None


class CopilotChatIn(BaseModel):
    message: str
    patient_id: Optional[str] = None
