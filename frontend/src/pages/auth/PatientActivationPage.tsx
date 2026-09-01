import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SignUp, useAuth } from "@clerk/clerk-react";
import { API_BASE_URL } from "@/services/client";
import { ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * After the invitation token is verified, the patient creates their real
 * account through Clerk's own <SignUp> widget (handles password +
 * verification) instead of a custom password form — the old form collected
 * a password that the backend never actually stored. Once Clerk confirms a
 * session, we call /api/auth/activate-patient with that session's token so
 * the backend can link this Clerk identity to the invited patient row.
 */
export const PatientActivationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { isSignedIn, isLoaded, getToken } = useAuth();

  const [loading, setLoading] = useState<boolean>(true);
  const [invitationData, setInvitationData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
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

  // Once Clerk confirms a signed-in session on this page, link it to the
  // invited patient record.
  useEffect(() => {
    if (!invitationData || !isLoaded || !isSignedIn || successMsg || activating) return;
    (async () => {
      try {
        setActivating(true);
        setErrorMsg(null);
        const sessionToken = await getToken();

        const res = await fetch(`${API_BASE_URL}/api/auth/activate-patient`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
          },
          body: JSON.stringify({ invitation_token: token }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.detail || "Failed to activate account.");
        }

        setSuccessMsg("Account activated successfully! Redirecting to Patient Portal...");
        setTimeout(() => {
          navigate("/home");
        }, 2000);
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to link your account.");
      } finally {
        setActivating(false);
      }
    })();
  }, [invitationData, isLoaded, isSignedIn]);

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
            Create your sign-in to activate your MedSys patient account.
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
          <div className="space-y-4">
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

            {isLoaded && isSignedIn ? (
              <p className="text-center font-mono text-xs text-stone">
                {activating ? "Activating account…" : "Finalizing…"}
              </p>
            ) : (
              <>
                <p className="text-[11px] font-mono text-stone text-center">
                  Sign up with the email above — your doctor never sees your password.
                </p>
                <div className="flex justify-center">
                  <SignUp routing="hash" unsafeMetadata={{ role: "patient" }} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
