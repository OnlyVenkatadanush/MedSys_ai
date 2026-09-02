import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { UserButton, useClerk, useUser } from "@clerk/clerk-react";
import {
  Home as HomeIcon,
  MessageSquare,
  MapPinned,
  FolderOpen,
  UserRound,
  Users,
  BarChart3,
  LogOut,
  Calendar,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getActiveRoleOverride, setActiveRoleOverride, setDemoAuthenticated } from "@/services/client";
import { CommandPalette } from "@/components/CommandPalette";
import { ErrorBoundary } from "@/components/ErrorBoundary";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const DOCTOR_NAV_ITEMS: NavItem[] = [
  { to: "/doctor/dashboard", label: "Dashboard", icon: HomeIcon },
  { to: "/doctor/patients", label: "Patients", icon: Users },
  { to: "/doctor/copilot", label: "Clinical Copilot", icon: Sparkles },
  { to: "/doctor/appointments", label: "Appointments", icon: Calendar },
  { to: "/profile", label: "Profile", icon: UserRound },
];

const PATIENT_NAV_ITEMS: NavItem[] = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/find-care", label: "FindCare", icon: MapPinned },
  { to: "/mydata", label: "MyData", icon: FolderOpen },
  { to: "/profile", label: "Profile", icon: UserRound },
];

export function NavShell() {
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const activeRoleOverride = getActiveRoleOverride();

  // Determine user role from Clerk metadata or active role context
  const userRole: "doctor" | "patient" =
    (user?.publicMetadata?.role as "doctor" | "patient") ||
    (user?.unsafeMetadata?.role as "doctor" | "patient") ||
    activeRoleOverride ||
    "doctor";

  const isDoctor = userRole === "doctor";
  const navItems = isDoctor ? DOCTOR_NAV_ITEMS : PATIENT_NAV_ITEMS;

  // Demo-mode sessions (the "Demo Credentials" login) never create a real
  // Clerk session, so there's nothing for Clerk's own sign-out to end —
  // clear the local role selection too and send everyone back to the
  // role-selection screen either way.
  const handleSignOut = async () => {
    try {
      if (isSignedIn) {
        await signOut();
      }
    } finally {
      setActiveRoleOverride(null);
      setDemoAuthenticated(false);
      try {
        localStorage.removeItem("medsys_role");
      } catch {}
      navigate("/select-role", { replace: true });
    }
  };

  return (
    <div className="min-h-dvh bg-bg-mist text-ink font-sans">
      <CommandPalette />
      <div className="mx-auto flex min-h-dvh w-full max-w-[1800px]">
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
                end={item.to !== "/patient/dashboard"}
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
              {isSignedIn && <UserButton afterSignOutUrl="/select-role" />}
              <div className="hidden flex-col xl:flex">
                <span className="font-mono text-[11px] text-stone">
                  {user?.fullName || (isDoctor ? "Dr. Sarah Smith" : "John Doe")}
                </span>
                <span className="text-[10px] uppercase font-mono tracking-wider text-teal-deep">
                  {isDoctor ? "Licensed Doctor" : "Patient Account"}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out"
              className="flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-stone transition-colors hover:bg-surface-card hover:text-clay-alert"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden text-xs font-medium xl:inline">Sign out</span>
            </button>
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
              {isSignedIn && <UserButton afterSignOutUrl="/select-role" />}
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-stone transition-colors hover:bg-bg-mist hover:text-clay-alert"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </header>

          <ErrorBoundary fallbackTitle="View Navigation Error">
            <Outlet />
          </ErrorBoundary>
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
