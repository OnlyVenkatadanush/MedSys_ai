import { Routes, Route, Navigate } from "react-router-dom";
import { AuthTokenBridge } from "@/components/auth/AuthTokenBridge";
import { ProtectedLayout } from "@/components/auth/ProtectedLayout";
import Landing from "@/pages/Landing";
import FindCare from "@/pages/FindCare";
import Profile from "@/pages/Profile";

import { SelectRolePage } from "@/pages/auth/SelectRolePage";
import { RoleLoginPage } from "@/pages/auth/RoleLoginPage";

import { DoctorCommandCenter } from "@/pages/doctor/DoctorCommandCenter";
import { MyPatients } from "@/pages/doctor/MyPatients";
import { PatientWorkspace } from "@/pages/doctor/PatientWorkspace";
import { ClinicalCopilot } from "@/pages/doctor/ClinicalCopilot";
import { DoctorAnalyticsPage } from "@/pages/doctor/DoctorAnalytics";
import { MultiPatientComparePage } from "@/pages/doctor/MultiPatientCompare";

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
          
          {/* Doctor Portal Routes */}
          <Route path="/doctor/dashboard" element={<DoctorCommandCenter />} />
          <Route path="/doctor/patients" element={<MyPatients />} />
          <Route path="/doctor/patient/:id" element={<PatientWorkspace />} />
          <Route path="/doctor/copilot" element={<ClinicalCopilot />} />
          <Route path="/doctor/analytics" element={<DoctorAnalyticsPage />} />
          <Route path="/doctor/compare" element={<MultiPatientComparePage />} />
          
          {/* Patient Portal Routes */}
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
