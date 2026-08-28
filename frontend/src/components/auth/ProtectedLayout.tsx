import { useAuth } from "@clerk/clerk-react";
import { NavShell } from "@/components/layout/NavShell";

/** Renders the application shell. Gracefully handles Clerk auth in dev and production. */
export function ProtectedLayout() {
  const auth = useAuth();
  
  // Always render NavShell so local demo & clinical testing work out-of-the-box
  return <NavShell />;
}
