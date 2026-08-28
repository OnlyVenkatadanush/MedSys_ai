from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    appointments,
    auth,
    chat,
    doctor,
    documents,
    facilities,
    health,
    home,
    mydata,
    patient,
    profile,
    symptoms,
)
from app.services.clerk_auth import require_clerk_auth

app = FastAPI(title="MedSys AI 2.0 Clinical Platform API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

auth_dep = [Depends(require_clerk_auth)]

@app.get("/")
def root():
    return {
        "message": "MedSys AI 2.0 Clinical Platform API is running",
        "docs": "/docs",
        "health": "/health",
        "frontend": "http://localhost:5173",
    }


# Public probe endpoints
app.include_router(health.router)
app.include_router(facilities.router)
app.include_router(auth.router)

# Multi-tenant Clinical & Patient Routers
app.include_router(doctor.router)
app.include_router(patient.router)
app.include_router(appointments.router)
app.include_router(documents.router)

# Legacy compatibility routers
app.include_router(home.router, dependencies=auth_dep)
app.include_router(chat.router, dependencies=auth_dep)
app.include_router(profile.router, dependencies=auth_dep)
app.include_router(symptoms.router, dependencies=auth_dep)
app.include_router(mydata.router, dependencies=auth_dep)
