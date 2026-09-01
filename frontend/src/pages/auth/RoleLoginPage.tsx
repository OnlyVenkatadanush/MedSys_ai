import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { Stethoscope, User, Lock, Mail, ArrowRight, CheckCircle, KeyRound } from "lucide-react";
import { setActiveRoleOverride, setDemoAuthenticated } from "@/services/client";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export function RoleLoginPage() {
  const { role } = useParams<{ role?: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedRole: "doctor" | "patient" = role === "patient" ? "patient" : "doctor";
  const isDoctor = selectedRole === "doctor";
  const redirectUrl = isDoctor ? "/doctor/patients" : "/home";
  // Mounted at both /sign-in/:role and /sign-up/:role (App.tsx) — which one
  // renders must follow the ACTUAL url, not a local flag. Clerk's own
  // <SignIn>/<SignUp> widgets cross-link to each other (signUpUrl/signInUrl
  // below) and navigate the browser there directly; if this page kept
  // rendering <SignIn path="/sign-in/..."> while the url had already moved
  // to /sign-up/..., Clerk's routing="path" mode sees its declared `path`
  // disagree with the real address and renders nothing.
  const isSignUp = location.pathname.startsWith("/sign-up");

  const [authMode, setAuthMode] = useState<"clerk" | "credentials">("clerk");
  const [email, setEmail] = useState<string>(
    isDoctor ? "dr.smith@medsys.ai" : "john.doe@example.com"
  );
  const [password, setPassword] = useState<string>("••••••••••••");
  const [loading, setLoading] = useState<boolean>(false);

  // Persist the intended role as soon as this page renders — not just when
  // the Demo Credentials form submits — so a real Clerk sign-in (Google
  // etc.) also carries it through the OAuth redirect. ProfileSetup reads
  // this back to skip its own "doctor or patient?" picker on first login.
  useEffect(() => {
    setActiveRoleOverride(selectedRole);
    localStorage.setItem("medsys_role", selectedRole);
  }, [selectedRole]);

  const handleCredentialSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setDemoAuthenticated(true);

    setTimeout(() => {
      setLoading(false);
      navigate(redirectUrl);
    }, 400);
  };

  return (
    <div className="min-h-dvh bg-bg-mist text-ink flex flex-col justify-between p-6 sm:p-10 font-sans">
      {/* Top Bar */}
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-bg-mist font-bold text-sm">
            +
          </span>
          <span className="font-display text-xl tracking-tight">MedSys AI</span>
        </Link>
        <Link to="/select-role" className="font-mono text-xs text-stone hover:text-ink">
          ← Switch Role
        </Link>
      </header>

      {/* Login Container */}
      <main className="mx-auto my-auto w-full max-w-[480px] space-y-6 py-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface-card border border-hairline font-mono text-xs uppercase tracking-wider text-stone mb-2">
            {isDoctor ? (
              <>
                <Stethoscope className="h-3.5 w-3.5 text-teal-deep" />
                <span>Doctor Portal Authentication</span>
              </>
            ) : (
              <>
                <User className="h-3.5 w-3.5 text-indigo-thread" />
                <span>Patient Portal Authentication</span>
              </>
            )}
          </div>
          <h1 className="font-display text-3xl tracking-tight text-ink">
            {isDoctor ? "Doctor" : "Patient"} {isSignUp ? "Sign Up" : "Sign In"}
          </h1>
          <p className="text-stone text-xs">
            {isDoctor
              ? "Authenticate with Clerk to access assigned patient panels."
              : "Authenticate with Clerk to access personalized care plans."}
          </p>
        </div>

        {/* Authentication Options Switcher */}
        <div className="flex items-center justify-center gap-2 p-1 bg-surface-card border border-hairline rounded-xl">
          <button
            type="button"
            onClick={() => setAuthMode("clerk")}
            className={`flex-1 py-1.5 px-3 rounded-lg font-mono text-xs font-medium uppercase tracking-wider transition-all ${
              authMode === "clerk"
                ? "bg-ink text-bg-mist shadow-xs"
                : "text-stone hover:text-ink"
            }`}
          >
            Clerk Authentication
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("credentials")}
            className={`flex-1 py-1.5 px-3 rounded-lg font-mono text-xs font-medium uppercase tracking-wider transition-all ${
              authMode === "credentials"
                ? "bg-ink text-bg-mist shadow-xs"
                : "text-stone hover:text-ink"
            }`}
          >
            Demo Credentials
          </button>
        </div>

        {/* Auth Body */}
        {authMode === "clerk" && CLERK_PUBLISHABLE_KEY ? (
          <div className="flex justify-center rounded-2xl border border-hairline bg-surface-card p-6 shadow-sm">
            {isSignUp ? (
              <SignUp
                routing="path"
                path={`/sign-up/${selectedRole}`}
                signInUrl={`/sign-in/${selectedRole}`}
                forceRedirectUrl={redirectUrl}
                unsafeMetadata={{ role: selectedRole }}
              />
            ) : (
              <SignIn
                routing="path"
                path={`/sign-in/${selectedRole}`}
                signUpUrl={`/sign-up/${selectedRole}`}
                forceRedirectUrl={redirectUrl}
              />
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-hairline bg-surface-card p-8 shadow-sm space-y-6">
            <form onSubmit={handleCredentialSignIn} className="space-y-4">
              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                  {isDoctor ? "Doctor Email" : "Patient Email"}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 h-4 w-4 text-stone" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist pl-10 pr-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-xs uppercase tracking-wider text-stone block mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 h-4 w-4 text-stone" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-hairline bg-bg-mist pl-10 pr-4 py-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-teal-deep"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-ink py-3 text-sm font-medium text-bg-mist hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-xs"
              >
                {loading ? (
                  "Authenticating..."
                ) : (
                  <>
                    <span>Sign In as {isDoctor ? "Doctor" : "Patient"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="rounded-xl border border-hairline bg-bg-mist p-3 font-mono text-[11px] text-stone flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-teal-deep shrink-0 mt-0.5" />
              <span>
                {isDoctor
                  ? "Doctors access clinical decision tools, patient timeline, and session sign-off."
                  : "Patients view doctor-approved prescriptions, medication logs, and diet."}
              </span>
            </div>
          </div>
        )}

        <div className="text-center font-mono text-xs text-stone">
          Need a different account?{" "}
          <Link to="/select-role" className="text-ink font-semibold hover:underline">
            Switch Role
          </Link>
        </div>
      </main>

      <footer className="text-center font-mono text-[11px] text-stone">
        MedSys AI — Differentiated Clerk Authentication Engine
      </footer>
    </div>
  );
}
