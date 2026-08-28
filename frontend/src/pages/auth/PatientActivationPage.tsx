import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "@/services/client";
import { ShieldCheck, Lock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

export const PatientActivationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [invitationData, setInvitationData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activating, setActivating] = useState<boolean>(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Missing activation invitation token in URL.");
      setLoading(false);
      return;
    }
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/invitation/${token}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Invalid activation token.");
      }
      const data = await res.json();
      setInvitationData(data);
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid or expired invitation token.");
    } finally {
      setLoading(false);
    }
  };

  const handleActivatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    try {
      setActivating(true);
      setErrorMsg(null);

      const res = await fetch(`${API_BASE_URL}/api/auth/activate-patient`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invitation_token: token,
          password,
          confirm_password: confirmPassword,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to activate account.");
      }

      const data = await res.json();
      setSuccessMsg("Account activated successfully! Redirecting to Patient Portal...");
      setTimeout(() => {
        navigate("/patient/dashboard");
      }, 2000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to set private password.");
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-mist flex items-center justify-center p-6 font-mono text-xs text-stone">
        <span>Verifying invitation token...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-mist flex items-center justify-center p-6 font-sans text-ink">
      <div className="w-full max-w-md bg-surface-card rounded-2xl border border-hairline p-8 space-y-6 shadow-sm">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-deep/10 text-teal-deep">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <h1 className="font-display text-2xl tracking-tight font-semibold">Activate Your Account</h1>
          <p className="font-mono text-xs text-stone">
            Set your private password to activate your MedSys patient account.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-clay-alert/30 bg-clay-alert/5 p-4 text-xs font-mono text-clay-alert flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-teal-deep/30 bg-teal-deep/5 p-4 text-xs font-mono text-teal-deep flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {invitationData && !successMsg && (
          <form onSubmit={handleActivatePassword} className="space-y-4">
            {/* Identity Card */}
            <div className="rounded-xl bg-bg-mist p-4 font-mono text-xs space-y-1.5 border border-hairline">
              <div className="flex justify-between text-stone">
                <span>Patient Name:</span>
                <span className="font-semibold text-ink">{invitationData.name}</span>
              </div>
              <div className="flex justify-between text-stone">
                <span>Patient ID:</span>
                <span className="font-bold text-teal-deep">{invitationData.patient_id_code}</span>
              </div>
              <div className="flex justify-between text-stone">
                <span>Email:</span>
                <span className="font-semibold text-ink">{invitationData.email}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Create Private Password *</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 pl-10 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
                <Lock className="h-4 w-4 text-stone absolute left-3.5 top-3.5" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-mono text-xs text-stone">Confirm Private Password *</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-hairline bg-bg-mist p-3 pl-10 font-sans text-sm text-ink outline-none focus:border-teal-deep"
                />
                <Lock className="h-4 w-4 text-stone absolute left-3.5 top-3.5" />
              </div>
            </div>

            <p className="text-[11px] font-mono text-stone text-center">
              Your password is encrypted. Your doctor cannot see or modify your private credentials.
            </p>

            <button
              type="submit"
              disabled={activating}
              className="w-full rounded-xl bg-ink py-3 text-xs font-mono text-bg-mist hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <span>{activating ? "Activating Account..." : "Activate Account & Login"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
