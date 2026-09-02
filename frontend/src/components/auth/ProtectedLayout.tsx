import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { AlertTriangle, LogOut } from "lucide-react";
import { NavShell } from "@/components/layout/NavShell";
import { ProfileSetup } from "@/pages/auth/ProfileSetup";
import {
  API_BASE_URL,
  getActiveRoleOverride,
  isDemoAuthenticated,
  setActiveRoleOverride,
  setDemoAuthenticated,
} from "@/services/client";

interface RoleMismatch {
  actualRole: "doctor" | "patient";
  intendedRole: "doctor" | "patient";
  email: string;
}

const DOCTOR_HOME = "/doctor/dashboard";
const PATIENT_HOME = "/home";

// Routes in App.tsx that only make sense for one role, despite some (Home,
// PatientChat, MyData) sitting under the "Shared Tools" route group with no
// role guard of their own — e.g. /chat always renders Chat in patient mode
// (see PatientChat.tsx), so a doctor landing there sees the wrong copilot
// entirely, not just wrong nav chrome.
function isPatientOnlyPath(pathname: string): boolean {
  return (
    pathname === "/home" ||
    pathname === "/chat" ||
    pathname === "/mydata" ||
    pathname === "/appointments" ||
    pathname.startsWith("/patient/")
  );
}

function isDoctorOnlyPath(pathname: string): boolean {
  return pathname.startsWith("/doctor/");
}

/**
 * Renders the application shell — but only for an actually-authenticated
 * visitor: either a real signed-in Clerk session, or someone who explicitly
 * submitted the Demo Credentials form (see RoleLoginPage). Anyone else gets
 * redirected to /select-role instead of silently seeing the app — merely
 * clicking a role card on /select-role does NOT count, since that happens
 * before any real sign-in step.
 *
 * For a real Clerk session, also checks whether this account has a linked
 * doctor/patient record yet (GET /api/auth/me). A brand-new sign-up has
 * none, so ProfileSetup is shown instead of the normal app until
 * registration completes.
 *
 * The one MedSys account can only ever be doctor XOR patient — a Clerk
 * identity is resolved to whichever collection actually has it linked (see
 * clerk_auth.get_current_user, doctor checked before patient). If someone
 * authenticates on the patient sign-in page with a Gmail account that's
 * already a doctor (or vice versa), `data.role` from /api/auth/me won't
 * match the role they picked on RoleLoginPage — that mismatch is caught
 * here and blocked with an explicit message instead of silently rendering
 * the wrong portal against an account with no real access to it.
 */
export function ProtectedLayout() {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [hasProfile, setHasProfile] = useState(true);
  const [roleMismatch, setRoleMismatch] = useState<RoleMismatch | null>(null);
  // The account's real role per the backend (doctor XOR patient — never
  // both), independent of whichever role the visitor happened to select on
  // RoleLoginPage. Null only while unresolved (still checking, or demo mode
  // where there's no /api/auth/me call to resolve it from — demo identity
  // IS the role override, see the fallback below).
  const [resolvedRole, setResolvedRole] = useState<"doctor" | "patient" | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setChecking(false);
      return;
    }

    setChecking(true);
    setRoleMismatch(null);
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setHasProfile(!!data.hasProfile);
          if (data.role === "doctor" || data.role === "patient") {
            setResolvedRole(data.role);
          }

          const intendedRole = getActiveRoleOverride();
          if (
            data.hasProfile &&
            (data.role === "doctor" || data.role === "patient") &&
            data.role !== intendedRole
          ) {
            setRoleMismatch({ actualRole: data.role, intendedRole, email: data.email || "" });
          }
        }
      } catch {
        // Fail open — a transient network error shouldn't block the app.
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `userId` is Clerk's own account id — re-check whenever it changes,
    // not just when isSignedIn flips. Clerk supports switching between
    // already-authenticated accounts (e.g. via the account switcher)
    // without ever setting isSignedIn to false, so keying this off
    // isSignedIn alone left the PREVIOUS account's hasProfile/session
    // cached and displayed after switching to a different Google account.
  }, [isLoaded, isSignedIn, userId]);

  // Demo mode has no /api/auth/me round trip to resolve a role from — the
  // role override the visitor picked IS their identity there, by design.
  const effectiveRole = resolvedRole ?? getActiveRoleOverride();

  const handleSignOut = async () => {
    try {
      await signOut();
    } finally {
      setActiveRoleOverride(null);
      setDemoAuthenticated(false);
      try {
        localStorage.removeItem("medsys_role");
      } catch {}
      navigate("/select-role", { replace: true });
    }
  };

  if (!isLoaded || checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg-mist font-mono text-xs text-stone">
        Loading your account…
      </div>
    );
  }

  if (!isSignedIn && !isDemoAuthenticated()) {
    return <Navigate to="/select-role" replace />;
  }

  if (roleMismatch) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg-mist p-6 font-sans">
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-clay-alert/30 bg-surface-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-clay-alert/10 text-clay-alert">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-xl text-ink">This account is already in use</h1>
            <p className="text-sm text-stone leading-relaxed">
              {roleMismatch.email ? <span className="font-medium text-ink">{roleMismatch.email}</span> : "This Google account"} is
              already registered as a <span className="font-semibold text-ink capitalize">{roleMismatch.actualRole}</span> on
              MedSys, so it can't also sign in as a {roleMismatch.intendedRole}. One MedSys account is always exactly one role.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setActiveRoleOverride(roleMismatch.actualRole);
                localStorage.setItem("medsys_role", roleMismatch.actualRole);
                setRoleMismatch(null);
                navigate(roleMismatch.actualRole === "doctor" ? DOCTOR_HOME : PATIENT_HOME, { replace: true });
              }}
              className="w-full rounded-full bg-ink py-2.5 text-sm font-medium text-bg-mist hover:opacity-90 transition-opacity"
            >
              Continue as {roleMismatch.actualRole === "doctor" ? "Doctor" : "Patient"}
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-1.5 rounded-full border border-hairline py-2.5 text-sm font-medium text-ink hover:bg-bg-mist transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out & use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSignedIn && !hasProfile) {
    return <ProfileSetup onComplete={() => setHasProfile(true)} />;
  }

  // Defense-in-depth beyond the mismatch screen above: whatever URL got the
  // visitor here (a typed address, browser back/forward, a stale bookmark,
  // or the mismatch screen's own redirect one tick late), never render a
  // patient-only page for a resolved doctor or vice versa — several of
  // these routes (Home, PatientChat, MyData) have no role guard of their
  // own and would otherwise render their one hardcoded mode regardless of
  // who's actually signed in.
  if (effectiveRole === "doctor" && isPatientOnlyPath(location.pathname)) {
    return <Navigate to={DOCTOR_HOME} replace />;
  }
  if (effectiveRole === "patient" && isDoctorOnlyPath(location.pathname)) {
    return <Navigate to={PATIENT_HOME} replace />;
  }

  // key={userId} forces every page under NavShell (Profile, Home, Chat,
  // MyData, ...) to fully unmount and remount when the signed-in account
  // changes, so their own mount-only data fetches run fresh instead of
  // continuing to show whatever the previous account had loaded — those
  // pages fetch on mount, not on every render, so without this key a
  // Clerk account switch alone wouldn't clear their state.
  return <NavShell key={userId ?? "demo"} />;
}
