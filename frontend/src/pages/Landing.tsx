import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Stethoscope, User, Activity, MessageSquare, MapPinned, FileStack, ShieldCheck, ArrowRight } from "lucide-react";
import { Thread } from "@/components/Thread";
import { staggerContainer, riseIn, riseInReduced } from "@/lib/motion";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { getActiveRoleOverride } from "@/services/client";

const FEATURES = [
  {
    icon: Stethoscope,
    title: "Doctor Decision Support & Sign-off",
    body: "Doctors review candidate differential diagnoses, drug interaction alerts, and officially sign off on patient care plans.",
  },
  {
    icon: Activity,
    title: "Patient Care & Medication Reminders",
    body: "Patients view doctor-approved prescriptions, log daily medication compliance, and manage doctor-recommended diet plans.",
  },
  {
    icon: MessageSquare,
    title: "Patient Clarification Chatbot",
    body: "Ask questions grounded in your doctor's published instructions, equipped with emergency red-flag triage detection.",
  },
  {
    icon: FileStack,
    title: "Lab Report OCR Storage Vault",
    body: "Upload diagnostic reports and prescriptions — automated OCR extracts and parses structured lab metrics.",
  },
];

export default function Landing() {
  const reduced = useReducedMotion();
  const item = reduced ? riseInReduced : riseIn;
  const activeRole = getActiveRoleOverride();

  return (
    <div className="min-h-dvh bg-bg-mist text-ink font-sans flex flex-col justify-between">
      {/* Header Bar */}
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-5 pt-6 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-bg-mist">
            <ThreadMark />
          </span>
          <span className="font-display text-lg tracking-tight">
            MedSys <span className="text-xs font-mono font-semibold text-teal-deep">2.0</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/select-role"
            className="font-mono text-xs text-stone transition-colors hover:text-ink px-3 py-1.5"
          >
            Role Selection
          </Link>
          <Link
            to="/select-role"
            className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-bg-mist transition-opacity hover:opacity-90 shadow-xs"
          >
            Sign In / Portal Entry
          </Link>
        </div>
      </header>

      {/* Main Hero Body */}
      <motion.main
        className="mx-auto flex max-w-[1100px] flex-col gap-16 px-5 pb-24 pt-12 sm:px-8 sm:pt-20"
        variants={staggerContainer(0.1)}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item} className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface-card px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-stone">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-deep" />
            <span>Clinical Decision Support & Patient Care Platform</span>
          </div>

          <h1 className="max-w-[18ch] font-display text-[42px] leading-[1.08] tracking-tight sm:text-[58px] text-ink">
            Grounded clinical intelligence for doctors & patients.
          </h1>

          <p className="max-w-[48ch] text-base text-stone sm:text-lg leading-relaxed">
            MedSys AI 2.0 connects attending doctors with their patients through role-based workflows, AI decision support, and doctor-signed advice.
          </p>

          {/* Differentiated Role Options */}
          <div className="pt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            {/* Doctor Entry Button */}
            <Link
              to="/sign-in/doctor"
              className="group rounded-2xl border border-hairline bg-surface-card p-4 hover:border-ink transition-all flex items-center justify-between gap-4 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-ink text-bg-mist flex items-center justify-center">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-display text-base text-ink block">Doctor Portal Login</span>
                  <span className="font-mono text-[11px] text-stone">Assigned Patients & Consultations</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-stone group-hover:text-ink group-hover:translate-x-1 transition-all" />
            </Link>

            {/* Patient Entry Button */}
            <Link
              to="/sign-in/patient"
              className="group rounded-2xl border border-hairline bg-surface-card p-4 hover:border-ink transition-all flex items-center justify-between gap-4 shadow-xs"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-teal-deep text-bg-mist flex items-center justify-center">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-display text-base text-ink block">Patient Portal Login</span>
                  <span className="font-mono text-[11px] text-stone">Care Plans, Medications & Chat</span>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-stone group-hover:text-ink group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        </motion.div>

        {/* Feature Cards Grid */}
        <motion.div
          variants={item}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-hairline bg-surface-card p-6 flex flex-col justify-between space-y-4"
            >
              <feature.icon
                className="h-6 w-6 text-teal-deep"
                strokeWidth={1.75}
              />
              <div>
                <h2 className="font-display text-base tracking-tight text-ink">
                  {feature.title}
                </h2>
                <p className="mt-2 text-xs text-stone leading-relaxed">{feature.body}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </motion.main>

      {/* Footer */}
      <footer className="mx-auto max-w-[1100px] px-5 pb-10 text-center font-mono text-[11px] text-stone sm:px-8">
        MedSys AI 2.0 — Multi-tenant Clinical Decision Support & Patient Care Platform.
      </footer>
    </div>
  );
}

function ThreadMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 12C5 12 5 4 8 4C11 4 11 12 14 12"
        stroke="url(#landingThreadGrad)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="landingThreadGrad" x1="0" y1="0" x2="16" y2="0">
          <stop offset="0%" stopColor="#5B5FEF" />
          <stop offset="100%" stopColor="#2F6E68" />
        </linearGradient>
      </defs>
    </svg>
  );
}
