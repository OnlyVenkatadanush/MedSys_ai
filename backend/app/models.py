from typing import Literal

from pydantic import BaseModel


class PollutantReading(BaseModel):
    label: str
    value: float
    unit: str


class EnvironmentSnapshot(BaseModel):
    locationName: str
    tempC: float
    condition: str
    humidityPct: int
    aqi: int
    aqiCategory: str
    pollutants: list[PollutantReading]
    updatedAt: str


class GraphNode(BaseModel):
    id: str
    label: str
    date: str
    description: str | None = None
    category: str | None = None


class GraphEdge(BaseModel):
    source: str
    target: str
    durationDays: int
    relation: str | None = None
    rationale: str | None = None


class KnowledgeGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class HomeSnapshot(BaseModel):
    status: Literal["stable", "moderate", "serious"]
    statusNote: str
    environment: EnvironmentSnapshot
    tip: str
    generalTip: str | None = None
    graph: KnowledgeGraph


ChatSourceKind = Literal["consultation", "consult_prescription", "prescription", "report", "web"]


class ChatSource(BaseModel):
    id: str
    title: str
    kind: ChatSourceKind
    uploadedAt: str
    excerpt: str
    url: str | None = None


class ChatMessage(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    createdAt: str
    isRedFlag: bool | None = None
    quickOptions: list[str] | None = None


class ChatSession(BaseModel):
    id: str
    title: str
    createdAt: str
    updatedAt: str
    sourceIds: list[str] = []


class ChatSessionIn(BaseModel):
    title: str | None = None


class ChatSessionSourcesIn(BaseModel):
    sourceIds: list[str]


class ChatMessageIn(BaseModel):
    content: str
    deepSearch: bool = False
    images: list[str] | None = None


class ModelStatus(BaseModel):
    provider: Literal["ollama", "groq", "gemini"]
    model: str
    reachable: bool


class Facility(BaseModel):
    id: str
    name: str
    type: Literal["hospital", "clinic", "diagnostic_center"]
    specialty: str
    address: str
    distanceKm: float
    lat: float
    lng: float
    openNow: bool
    phone: str | None = None


class Medication(BaseModel):
    name: str
    dosage: str


class EmergencyContact(BaseModel):
    name: str
    relation: str
    phone: str


class ProfileRecord(BaseModel):
    fullName: str
    age: int
    weightKg: float
    heightCm: float
    bmi: float
    bloodGroup: str
    conditions: list[str]
    medications: list[Medication]
    emergencyContact: EmergencyContact


class ProfileIn(BaseModel):
    fullName: str
    age: int
    weightKg: float
    heightCm: float
    bloodGroup: str
    conditions: list[str] = []
    medications: list[Medication] = []
    emergencyContact: EmergencyContact
