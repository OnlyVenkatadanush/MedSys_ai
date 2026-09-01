import { Routes, Route, Navigate } from "react-router-dom";
import { AuthTokenBridge } from "@/components/auth/AuthTokenBridge";
import { ProtectedLayout } from "@/components/auth/ProtectedLayout";
import Landing from "@/pages/Landing";
import FindCare from "@/pages/FindCare";
import Profile from "@/pages/Profile";
import Home from "@/pages/Home";
import MyData from "@/pages/MyData";

import { SelectRolePage } from "@/pages/auth/SelectRolePage";
import { RoleLoginPage } from "@/pages/auth/RoleLoginPage";
import { DoctorRegistrationPage } from "@/pages/auth/DoctorRegistration";
import { PatientActivationPage } from "@/pages/auth/PatientActivationPage";

import { DoctorCommandCenter } from "@/pages/doctor/DoctorCommandCenter";

import { MyPatients } from "@/pages/doctor/MyPatients";
import { AddPatientWizard } from "@/pages/doctor/AddPatientWizard";
import { PatientWorkspace } from "@/pages/doctor/PatientWorkspace";
import { ClinicalCopilot } from "@/pages/doctor/ClinicalCopilot";
import { DoctorAnalyticsPage } from "@/pages/doctor/DoctorAnalytics";
import { DoctorAppointmentsPage } from "@/pages/doctor/DoctorAppointments";

import { PatientDashboard } from "@/pages/patient/PatientDashboard";
import { MedicationTracker } from "@/pages/patient/MedicationTracker";
import { DietManager } from "@/pages/patient/DietManager";
import { PatientChat } from "@/pages/patient/PatientChat";
import { LabReports } from "@/pages/patient/LabReports";
import { Appointments as PatientAppointmentsPage } from "@/pages/patient/Appointments";

export default function App() {
  return (
    <>
      <AuthTokenBridge />
      <Routes>
        {/* Public Landing, Role Selection & Password Activation */}
        <Route path="/" element={<Landing />} />
        <Route path="/select-role" element={<SelectRolePage />} />
        <Route path="/doctor/register" element={<DoctorRegistrationPage />} />
        <Route path="/activate-account" element={<PatientActivationPage />} />

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
          <Route path="/doctor/add-patient" element={<AddPatientWizard />} />
          <Route path="/doctor/patient/:id" element={<PatientWorkspace />} />
          <Route path="/doctor/copilot" element={<ClinicalCopilot />} />
          <Route path="/doctor/analytics" element={<DoctorAnalyticsPage />} />
          <Route path="/doctor/appointments" element={<DoctorAppointmentsPage />} />
          
          {/* Patient Portal Routes */}
          <Route path="/patient/dashboard" element={<PatientDashboard />} />
          <Route path="/patient/medications" element={<MedicationTracker />} />
          <Route path="/patient/diet" element={<DietManager />} />
          <Route path="/patient/chat" element={<PatientChat />} />
          <Route path="/patient/lab-reports" element={<LabReports />} />
          <Route path="/patient/appointments" element={<PatientAppointmentsPage />} />
          <Route path="/appointments" element={<PatientAppointmentsPage />} />

          {/* Shared Tools */}
          <Route path="/find-care" element={<FindCare />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<PatientChat />} />
          <Route path="/home" element={<Home />} />
          <Route path="/mydata" element={<MyData />} />
        </Route>
      </Routes>
    </>
  );
}
