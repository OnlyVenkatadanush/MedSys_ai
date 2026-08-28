import { Routes, Route, Navigate } from "react-router-dom";
import { AuthTokenBridge } from "@/components/auth/AuthTokenBridge";
import { ProtectedLayout } from "@/components/auth/ProtectedLayout";
import Landing from "@/pages/Landing";
import FindCare from "@/pages/FindCare";
import Profile from "@/pages/Profile";

import { SelectRolePage } from "@/pages/auth/SelectRolePage";
import { RoleLoginPage } from "@/pages/auth/RoleLoginPage";

import { DoctorDashboard } from "@/pages/doctor/DoctorDashboard";
import { PatientDashboard } from "@/pages/patient/PatientDashboard";
import { MedicationTracker } from "@/pages/patient/MedicationTracker";
import { DietManager } from "@/pages/patient/DietManager";
import { PatientChat } from "@/pages/patient/PatientChat";
import { LabReports } from "@/pages/patient/LabReports";
import { Appointments } from "@/pages/patient/Appointments";

export default function App() {
  return (
    <>
      <AuthTokenBridge />
      <Routes>
        {/* Public Landing & Authentication Selection */}
        <Route path="/" element={<Landing />} />
        <Route path="/select-role" element={<SelectRolePage />} />
        <Route path="/sign-in" element={<RoleLoginPage />} />
        <Route path="/sign-in/:role" element={<RoleLoginPage />} />
        <Route path="/sign-up" element={<RoleLoginPage />} />
        <Route path="/sign-up/:role" element={<RoleLoginPage />} />

        {/* Protected App Shell */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<Navigate to="/doctor/dashboard" replace />} />
          
          {/* Doctor Portal */}
          <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
          
          {/* Patient Portal */}
          <Route path="/patient/dashboard" element={<PatientDashboard />} />
          <Route path="/patient/medications" element={<MedicationTracker />} />
          <Route path="/patient/diet" element={<DietManager />} />
          <Route path="/patient/chat" element={<PatientChat />} />
          <Route path="/patient/lab-reports" element={<LabReports />} />
          <Route path="/appointments" element={<Appointments />} />

          {/* Shared Tools */}
          <Route path="/find-care" element={<FindCare />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<PatientChat />} />
        </Route>
      </Routes>
    </>
  );
}
