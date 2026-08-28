import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { UserButton, useUser } from "@clerk/clerk-react";
import {
  Stethoscope,
  Activity,
  MessageSquare,
  MapPinned,
  FileStack,
  UserRound,
  Pill,
  Utensils,
  Calendar,
  Users,
  Sparkles,
  BarChart3,
  GitCompare,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getActiveRoleOverride } from "@/services/client";
import { CommandPalette } from "@/components/CommandPalette";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const DOCTOR_NAV_ITEMS: NavItem[] = [
  { to: "/doctor/dashboard", label: "Command Center", icon: Stethoscope },
  { to: "/doctor/patients", label: "My Patients", icon: Users },
  { to: "/doctor/copilot", label: "Clinical Copilot", icon: Sparkles },
  { to: "/doctor/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/doctor/appointments", label: "Appointments", icon: Calendar },
  { to: "/find-care", label: "Find Care", icon: MapPinned },
  { to: "/profile", label: "Profile", icon: UserRound },
];

const PATIENT_NAV_ITEMS: NavItem[] = [
  { to: "/patient/dashboard", label: "Overview", icon: Activity },
  { to: "/patient/medications", label: "Medications", icon: Pill },
  { to: "/patient/diet", label: "Diet", icon: Utensils },
  { to: "/patient/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/patient/lab-reports", label: "Lab Reports", icon: FileStack },
  { to: "/patient/appointments", label: "Appointments", icon: Calendar },
  { to: "/find-care", label: "Find Care", icon: MapPinned },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export function NavShell() {
  const { user } = useUser();
  const activeRoleOverride = getActiveRoleOverride();
  
  // Determine user role from Clerk metadata or active role context
  const userRole: "doctor" | "patient" =
    (user?.publicMetadata?.role as "doctor" | "patient") ||
    (user?.unsafeMetadata?.role as "doctor" | "patient") ||
    activeRoleOverride ||
    "doctor";

  const isDoctor = userRole === "doctor";
  const navItems = isDoctor ? DOCTOR_NAV_ITEMS : PATIENT_NAV_ITEMS;

  return (
    <div className="min-h-dvh bg-bg-mist text-ink font-sans">
      <CommandPalette />
      <div className="mx-auto flex min-h-dvh max-w-[1400px]">
        {/* Left Sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-[80px] shrink-0 flex-col items-center gap-1 border-r border-hairline py-6 lg:flex xl:w-[240px] xl:items-stretch xl:px-4">
          {/* Logo Brand */}
          <div className="mb-6 flex w-full items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-bg-mist">
                <ThreadMark />
              </span>
              <span className="hidden font-display text-xl tracking-tight xl:inline">
                MedSys <span className="font-sans text-xs font-semibold text-teal-deep">2.0</span>
              </span>
            </div>
          </div>

          {/* Role Status Badge (No Toggle Switcher) */}
          <div className="mb-6 rounded-xl border border-hairline bg-surface-card p-3 shadow-xs">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isDoctor ? "bg-teal-deep" : "bg-indigo-thread"}`}></span>
              <span className="font-mono text-xs uppercase font-bold tracking-wider text-ink">
                {isDoctor ? "Doctor Portal" : "Patient Portal"}
              </span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex w-full flex-1 flex-col gap-1 overflow-y-auto pr-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to !== "/doctor/dashboard" && item.to !== "/patient/dashboard"}
                className={({ isActive }) =>
                  [
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 font-medium",
                    isActive
                      ? "bg-ink text-bg-mist"
                      : "text-stone hover:bg-surface-card hover:text-ink",
                  ].join(" ")
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                <span className="hidden xl:inline">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* User Account / Signout */}
          <div className="mt-auto flex w-full items-center justify-between border-t border-hairline px-2 pt-4">
            <div className="flex items-center gap-2">
              <UserButton afterSignOutUrl="/" />
              <div className="hidden flex-col xl:flex">
                <span className="font-mono text-[11px] text-stone">
                  {user?.fullName || (isDoctor ? "Dr. Sarah Smith" : "John Doe")}
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider text-teal-deep">
                  {isDoctor ? "Licensed Doctor" : "Patient Account"}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-x-hidden pb-24 lg:pb-0">
          {/* Mobile Header Bar */}
          <header className="flex items-center justify-between border-b border-hairline bg-surface-card px-5 py-4 lg:hidden">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-bg-mist">
                <ThreadMark />
              </span>
              <span className="font-display text-lg tracking-tight">
                MedSys {isDoctor ? "Doctor" : "Patient"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>

          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Bar Navigation */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-hairline bg-surface-card/95 backdrop-blur lg:hidden"
      >
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-150",
                isActive ? "text-teal-deep font-semibold" : "text-stone",
              ].join(" ")
            }
          >
            <item.icon className="h-[19px] w-[19px]" strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function ThreadMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 12C5 12 5 4 8 4C11 4 11 12 14 12"
        stroke="url(#navThreadGrad)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="navThreadGrad" x1="0" y1="0" x2="16" y2="0">
          <stop offset="0%" stopColor="#5B5FEF" />
          <stop offset="100%" stopColor="#2F6E68" />
        </linearGradient>
      </defs>
    </svg>
  );
}
