"""Seed data used until MongoDB collections are populated by the real
ingestion pipeline. Shapes mirror the frontend's mock fixtures so the API is
a drop-in replacement once VITE_API_BASE_URL is pointed at this server.
"""

from datetime import datetime, timezone

HOME_SNAPSHOT = {
    "status": "stable",
    "statusNote": "No emerging patterns in your recent logs.",
    "environment": {
        "locationName": "Bengaluru, IN",
        "tempC": 27,
        "condition": "Hazy",
        "humidityPct": 64,
        "aqi": 168,
        "aqiCategory": "Unhealthy",
        "pollutants": [
            {"label": "PM2.5", "value": 98, "unit": "µg/m³"},
            {"label": "PM10", "value": 142, "unit": "µg/m³"},
            {"label": "CO", "value": 0.6, "unit": "ppm"},
            {"label": "NO2", "value": 34, "unit": "ppb"},
            {"label": "O3", "value": 41, "unit": "ppb"},
            {"label": "SO2", "value": 9, "unit": "ppb"},
        ],
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    },
    "tip": (
        "Outdoor PM2.5 is elevated today. Keep windows closed through the "
        "afternoon and favor indoor activity if you're prone to respiratory "
        "symptoms."
    ),
    "graph": {"nodes": [], "edges": []},
}

CHAT_SOURCES = [
    {
        "id": "src-1",
        "title": "CBC Panel — Aug 12, 2026",
        "kind": "report",
        "uploadedAt": "2026-08-12",
        "excerpt": "Hemoglobin 13.9 g/dL, WBC 6.4 x10^9/L, Platelets 244 x10^9/L — all within reference range.",
    },
    {
        "id": "src-2",
        "title": "Cardiology consult summary",
        "kind": "consultation",
        "uploadedAt": "2026-07-30",
        "excerpt": "No acute findings on ECG. Recommended follow-up if chest discomfort recurs with exertion.",
    },
]

FACILITIES = [
    {
        "id": "f-1",
        "name": "Manipal Hospital, Old Airport Road",
        "type": "hospital",
        "specialty": "Cardiology",
        "address": "98, HAL Old Airport Rd, Kodihalli, Bengaluru",
        "distanceKm": 2.4,
        "lat": 12.9589,
        "lng": 77.6490,
        "openNow": True,
        "phone": "080 2502 4444",
    },
    {
        "id": "f-2",
        "name": "Apollo Clinic, Indiranagar",
        "type": "clinic",
        "specialty": "General Medicine",
        "address": "100 Feet Rd, Indiranagar, Bengaluru",
        "distanceKm": 3.1,
        "lat": 12.9654,
        "lng": 77.6415,
        "openNow": True,
        "phone": None,
    },
    {
        "id": "f-3",
        "name": "Fortis Hospital, Bannerghatta Road",
        "type": "hospital",
        "specialty": "Cardiology",
        "address": "154/9, Bannerghatta Rd, Bengaluru",
        "distanceKm": 8.7,
        "lat": 12.8947,
        "lng": 77.5987,
        "openNow": False,
        "phone": "080 6621 4444",
    },
    {
        "id": "f-4",
        "name": "Cloudnine Clinic, Koramangala",
        "type": "clinic",
        "specialty": "Neurology",
        "address": "6th Block, Koramangala, Bengaluru",
        "distanceKm": 5.6,
        "lat": 12.9352,
        "lng": 77.6245,
        "openNow": True,
        "phone": None,
    },
    {
        "id": "f-5",
        "name": "SRL Diagnostics, HSR Layout",
        "type": "diagnostic_center",
        "specialty": "Diagnostics",
        "address": "27th Main, HSR Layout, Bengaluru",
        "distanceKm": 6.2,
        "lat": 12.9121,
        "lng": 77.6446,
        "openNow": True,
        "phone": "080 4718 4444",
    },
    {
        "id": "f-6",
        "name": "Metropolis Healthcare, Jayanagar",
        "type": "diagnostic_center",
        "specialty": "Diagnostics",
        "address": "4th Block, Jayanagar, Bengaluru",
        "distanceKm": 7.4,
        "lat": 12.9308,
        "lng": 77.5838,
        "openNow": False,
        "phone": None,
    },
]

DEFAULT_PROFILE = {
    "fullName": "John Doe",
    "age": 30,
    "gender": "prefer_not_to_say",
    "heightCm": 170,
    "weightKg": 70,
    "bmi": 24.2,
    "bloodGroup": "O+",
    "allergies": [],
    "conditions": [],
    "medications": [],
    "emergencyContact": {"name": "", "relation": "", "phone": ""},
    "vitalsGoal": {"systolic": 120, "diastolic": 80, "restingHeartRateBpm": 72, "glucoseMgDl": 100},
}

