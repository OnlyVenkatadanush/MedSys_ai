import type {
  ChatMessage,
  ChatSession,
  ChatSource,
  Facility,
  HomeSnapshot,
  ModelStatus,
  ProfileRecord,
} from "@/types";

export const mockHomeSnapshot: HomeSnapshot = {
  status: "serious",
  statusNote: "A pattern across this week's logs needs your attention.",
  environment: {
    locationName: "Bengaluru, IN",
    tempC: 27,
    condition: "Hazy",
    humidityPct: 64,
    aqi: 168,
    aqiCategory: "Unhealthy",
    pollutants: [
      { label: "PM2.5", value: 98, unit: "µg/m³" },
      { label: "PM10", value: 142, unit: "µg/m³" },
      { label: "CO", value: 0.6, unit: "ppm" },
      { label: "NO2", value: 34, unit: "ppb" },
      { label: "O3", value: 41, unit: "ppb" },
      { label: "SO2", value: 9, unit: "ppb" },
    ],
    updatedAt: new Date().toISOString(),
  },
  tip: "Outdoor PM2.5 is elevated today. Keep windows closed through the afternoon and favor indoor activity if you're prone to respiratory symptoms.",
  generalTip:
    "Aim for at least seven hours of sleep tonight — consistent sleep timing does more for daytime energy than the total hours alone.",
  graph: {
    nodes: [
      { id: "n0", label: "Chest pain", date: "Mon, Aug 17" },
      { id: "n1", label: "Night sweats", date: "Thu, Aug 20" },
      { id: "n2", label: "Fatigue", date: "Tue, Aug 11" },
      { id: "n3", label: "Headache", date: "Wed, Aug 19" },
    ],
    edges: [
      { source: "n0", target: "n1", durationDays: 3 },
      { source: "n0", target: "n2", durationDays: 6 },
      { source: "n0", target: "n3", durationDays: 2 },
      { source: "n1", target: "n2", durationDays: 9 },
      { source: "n1", target: "n3", durationDays: 1 },
      { source: "n2", target: "n3", durationDays: 8 },
    ],
  },
};

export const mockModelStatus: ModelStatus = {
  provider: "ollama",
  model: "llama3.1:8b",
  reachable: true,
};

export const mockChatSources: ChatSource[] = [
  {
    id: "src-1",
    title: "CBC Panel — Aug 12, 2026",
    kind: "report",
    uploadedAt: "2026-08-12",
    excerpt: "Hemoglobin 13.9 g/dL, WBC 6.4 x10^9/L, Platelets 244 x10^9/L — all within reference range.",
  },
  {
    id: "src-2",
    title: "Cardiology consult summary",
    kind: "consultation",
    uploadedAt: "2026-07-30",
    excerpt: "No acute findings on ECG. Recommended follow-up if chest discomfort recurs with exertion.",
  },
];

export const mockChatSessions: ChatSession[] = [
  {
    id: "sess-1",
    title: "Chest pain and night sweats",
    createdAt: "2026-08-19T09:00:00Z",
    updatedAt: "2026-08-19T09:01:40Z",
    sourceIds: ["src-1"],
  },
  {
    id: "sess-2",
    title: "Seasonal allergy meds",
    createdAt: "2026-08-10T14:00:00Z",
    updatedAt: "2026-08-10T14:03:00Z",
    sourceIds: [],
  },
];

export const mockChatMessages: ChatMessage[] = [
  {
    id: "m-1",
    role: "assistant",
    content:
      "I'm grounding this conversation on your CBC panel from Aug 12 and your cardiology consult from Jul 30. What would you like to know?",
    createdAt: "2026-08-19T09:00:00Z",
  },
  {
    id: "m-2",
    role: "user",
    content: "I've had chest pain earlier this week and now some night sweats. Should I be worried?",
    createdAt: "2026-08-19T09:01:00Z",
  },
  {
    id: "m-3",
    role: "assistant",
    content:
      "That combination — chest pain followed by night sweats within the same week — is a pattern worth flagging. It's already surfaced on your Home dashboard as a possible cardiac risk signal. Your last cardiology consult showed no acute findings, but that was three weeks ago. I'd recommend contacting a physician if the chest pain recurs, especially with exertion.",
    createdAt: "2026-08-19T09:01:40Z",
  },
];

export const mockFacilities: Facility[] = [
  {
    id: "f-1",
    name: "Manipal Hospital, Old Airport Road",
    type: "hospital",
    specialty: "Cardiology",
    address: "98, HAL Old Airport Rd, Kodihalli, Bengaluru",
    distanceKm: 2.4,
    lat: 12.9589,
    lng: 77.649,
    openNow: true,
    phone: "080 2502 4444",
  },
  {
    id: "f-2",
    name: "Apollo Clinic, Indiranagar",
    type: "clinic",
    specialty: "General Medicine",
    address: "100 Feet Rd, Indiranagar, Bengaluru",
    distanceKm: 3.1,
    lat: 12.9654,
    lng: 77.6415,
    openNow: true,
  },
  {
    id: "f-3",
    name: "Fortis Hospital, Bannerghatta Road",
    type: "hospital",
    specialty: "Cardiology",
    address: "154/9, Bannerghatta Rd, Bengaluru",
    distanceKm: 8.7,
    lat: 12.8947,
    lng: 77.5987,
    openNow: false,
    phone: "080 6621 4444",
  },
  {
    id: "f-4",
    name: "Cloudnine Clinic, Koramangala",
    type: "clinic",
    specialty: "Neurology",
    address: "6th Block, Koramangala, Bengaluru",
    distanceKm: 5.6,
    lat: 12.9352,
    lng: 77.6245,
    openNow: true,
  },
  {
    id: "f-5",
    name: "SRL Diagnostics, HSR Layout",
    type: "diagnostic_center",
    specialty: "Diagnostics",
    address: "27th Main, HSR Layout, Bengaluru",
    distanceKm: 6.2,
    lat: 12.9121,
    lng: 77.6446,
    openNow: true,
    phone: "080 4718 4444",
  },
  {
    id: "f-6",
    name: "Metropolis Healthcare, Jayanagar",
    type: "diagnostic_center",
    specialty: "Diagnostics",
    address: "4th Block, Jayanagar, Bengaluru",
    distanceKm: 7.4,
    lat: 12.9308,
    lng: 77.5838,
    openNow: false,
  },
];

export const mockProfile: ProfileRecord = {
  fullName: "John Doe",
  age: 30,
  weightKg: 70,
  heightCm: 170,
  bmi: 24.2,
  bloodGroup: "O+",
  conditions: ["Seasonal allergic rhinitis"],
  medications: [{ name: "Cetirizine", dosage: "10mg, as needed" }],
  emergencyContact: {
    name: "Sam Reyes",
    relation: "Sibling",
    phone: "+91 98765 43210",
  },
};
