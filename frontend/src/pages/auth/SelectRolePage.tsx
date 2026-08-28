import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Stethoscope, User, ArrowRight, ShieldCheck } from "lucide-react";
import { setActiveRoleOverride } from "@/services/client";

export function SelectRolePage() {
  const navigate = useNavigate();

  const handleSelectRole = (role: "doctor" | "patient") => {
    setActiveRoleOverride(role);
    localStorage.setItem("medsys_role", role);
    navigate(`/sign-in/${role}`);
  };

  return (
    <div className="min-h-dvh bg-bg-mist text-ink flex flex-col justify-between p-6 sm:p-10 font-sans">
      {/* Top Brand Bar */}
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg-mist font-bold text-sm">
            +
          </span>
          <span className="font-display text-xl tracking-tight">MedSys AI</span>
        </Link>
        <Link to="/" className="font-mono text-xs text-stone hover:text-ink">
          ← Back to home
        </Link>
      </header>

      {/* Role Selection Container */}
      <main className="mx-auto my-auto w-full max-w-[800px] space-y-8 py-8">
        <div className="text-center space-y-3">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-stone">
            Portal Access & Authentication
          </p>
          <h1 className="font-display text-3xl sm:text-4xl tracking-tight text-ink">
            How are you accessing MedSys AI?
          </h1>
          <p className="text-stone text-sm sm:text-base max-w-[50ch] mx-auto">
            Please select your portal role to continue with credential sign-in.
          </p>
        </div>

        {/* 2 Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Doctor Role Card */}
          <div
            onClick={() => handleSelectRole("doctor")}
            className="group relative rounded-2xl border border-hairline bg-surface-card p-8 cursor-pointer transition-all duration-200 hover:border-ink hover:shadow-md flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-ink/5 border border-hairline flex items-center justify-center text-ink group-hover:bg-ink group-hover:text-bg-mist transition-colors">
                  <Stethoscope className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <span className="font-mono text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-teal-deep/10 text-teal-deep border border-teal-deep/20">
                  Doctor Portal
                </span>
              </div>
              <div>
                <h2 className="font-display text-xl tracking-tight text-ink">
                  I am a Doctor / Practitioner
                </h2>
                <p className="mt-2 text-xs text-stone leading-relaxed">
                  Access patient panels, conduct AI-assisted consultations, review differential diagnoses, and sign off on published care plans.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-hairline pt-4 font-mono text-xs text-ink font-semibold group-hover:text-teal-deep">
              <span>Sign in as Doctor</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>

          {/* Patient Role Card */}
          <div
            onClick={() => handleSelectRole("patient")}
            className="group relative rounded-2xl border border-hairline bg-surface-card p-8 cursor-pointer transition-all duration-200 hover:border-ink hover:shadow-md flex flex-col justify-between space-y-6"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-12 w-12 rounded-xl bg-ink/5 border border-hairline flex items-center justify-center text-ink group-hover:bg-ink group-hover:text-bg-mist transition-colors">
                  <User className="h-6 w-6" strokeWidth={1.75} />
                </div>
                <span className="font-mono text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-indigo-thread/10 text-indigo-thread border border-indigo-thread/20">
                  Patient Portal
                </span>
              </div>
              <div>
                <h2 className="font-display text-xl tracking-tight text-ink">
                  I am a Patient
                </h2>
                <p className="mt-2 text-xs text-stone leading-relaxed">
                  View doctor-approved diagnosis & prescriptions, track daily medication doses, manage diet, and chat with your clarification assistant.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-hairline pt-4 font-mono text-xs text-ink font-semibold group-hover:text-teal-deep">
              <span>Sign in as Patient</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </div>
        </div>

        <div className="text-center font-mono text-xs text-stone flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-teal-deep" />
          <span>Role-based access control and patient data isolation active.</span>
        </div>
      </main>

      <footer className="text-center font-mono text-[11px] text-stone">
        MedSys AI — Role Differentiated Authentication System
      </footer>
    </div>
  );
}
