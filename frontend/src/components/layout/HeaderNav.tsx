import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getActiveRoleOverride, setActiveRoleOverride } from "@/services/client";

export const HeaderNav: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [role, setRole] = useState<"doctor" | "patient">(getActiveRoleOverride());

  const handleRoleToggle = (newRole: "doctor" | "patient") => {
    setRole(newRole);
    setActiveRoleOverride(newRole);
    localStorage.setItem("medsys_role", newRole);
    if (newRole === "doctor") {
      navigate("/doctor/dashboard");
    } else {
      navigate("/patient/dashboard");
    }
  };

  const isDoctor = role === "doctor";

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold text-xl shadow-lg shadow-cyan-500/20">
            +
          </div>
          <Link to={isDoctor ? "/doctor/dashboard" : "/patient/dashboard"} className="text-xl font-bold tracking-tight text-white hover:text-cyan-400 transition-colors">
            MedSys <span className="text-cyan-400 font-extrabold">AI 2.0</span>
          </Link>
        </div>

        {/* Dynamic Navigation Links based on Role */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-800/60 p-1 rounded-xl border border-slate-700/50">
          {isDoctor ? (
            <>
              <Link
                to="/doctor/dashboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname.startsWith("/doctor")
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                👨‍⚕️ Doctor Portal
              </Link>
              <Link
                to="/find-care"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/find-care"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                🏥 Facilities
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/patient/dashboard"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/patient/dashboard"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                🏠 Patient Overview
              </Link>
              <Link
                to="/patient/medications"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/patient/medications"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                💊 Medications
              </Link>
              <Link
                to="/patient/diet"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/patient/diet"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                🥗 Diet
              </Link>
              <Link
                to="/patient/chat"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/patient/chat"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                💬 AI Assistant
              </Link>
              <Link
                to="/patient/lab-reports"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/patient/lab-reports"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                📑 Lab Reports
              </Link>
              <Link
                to="/appointments"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  location.pathname === "/appointments"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-slate-300 hover:text-white hover:bg-slate-700/50"
                }`}
              >
                📅 Appointments
              </Link>
            </>
          )}
        </nav>

        {/* Role Switcher & User Profile Info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => handleRoleToggle("doctor")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                isDoctor
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Doctor View
            </button>
            <button
              onClick={() => handleRoleToggle("patient")}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                !isDoctor
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Patient View
            </button>
          </div>

          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200">
            {isDoctor ? "DR" : "PT"}
          </div>
        </div>
      </div>
    </header>
  );
};
