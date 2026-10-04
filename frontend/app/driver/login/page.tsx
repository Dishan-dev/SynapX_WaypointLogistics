"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getToken } from "@/lib/auth";
import { clearSignOutReason, SIGN_OUT_MESSAGES, signOutReason } from "@/lib/driverSession";
import { Navigation } from "lucide-react";

const noSubscription = () => () => {};

/**
 * Drivers sign in on the shared Waypoint (Keycloak) login. After the app logged
 * a driver out (account turned off, not a driver, login no longer valid) this
 * says why instead of going straight back: with the Keycloak session still
 * open, that would sign the same account in again, round and round.
 */
export default function DriverLoginPage() {
  const router = useRouter();
  const { loginWithKeycloak, logout } = useAuth();
  const reason = useSyncExternalStore(noSubscription, signOutReason, () => null);

  useEffect(() => {
    // Read storage itself: on the first render after a page load `reason` is
    // still the server's answer (null), and the app clears the login directly.
    if (getToken() !== null) router.replace("/driver");
    else if (!signOutReason()) void loginWithKeycloak("driver");
  }, [loginWithKeycloak, router]);

  function signInAgain() {
    clearSignOutReason();
    // Another account: end the Keycloak session too, or it signs this one back in.
    if (reason === "expired") void loginWithKeycloak("driver");
    else void logout(true);
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900 flex flex-col items-center justify-center p-4 font-sans antialiased">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="h-12 w-12 rounded-xl bg-[#092C4C] flex items-center justify-center text-white shadow-sm">
          <Navigation className="h-6 w-6 text-white" />
        </div>
        {reason ? (
          <>
            <p role="alert" className="text-sm font-medium text-slate-900">{SIGN_OUT_MESSAGES[reason]}</p>
            <button
              type="button"
              onClick={signInAgain}
              className="h-11 px-5 rounded-lg bg-[#092C4C] text-white text-sm font-semibold"
            >
              {reason === "expired" ? "Log in again" : "Sign in with another account"}
            </button>
          </>
        ) : (
          <>
            <div className="relative mx-auto w-10 h-10 flex items-center justify-center mt-2">
              <div className="absolute inset-0 rounded-full border-3 border-slate-200 border-t-[#092C4C] animate-spin" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">Redirecting to Driver Sign-in</h1>
              <p className="text-xs text-slate-500 mt-1">Connecting to Keycloak Single Sign-On...</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
