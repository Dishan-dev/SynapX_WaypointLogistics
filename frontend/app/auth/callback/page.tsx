"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  Truck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  extractRoles,
  getDefaultPortalForRoles,
  KeycloakAppRole,
  ROLE_CONFIGS,
} from "@/lib/keycloak";
import {
  clearAuthSession,
  PKCE_STATE_KEY,
  PKCE_VERIFIER_KEY,
  saveAuthSession,
  TARGET_ROLE_KEY,
} from "@/lib/auth";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [detectedRoles, setDetectedRoles] = useState<KeycloakAppRole[]>([]);
  const [destination, setDestination] = useState<string>("/");
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    async function processCallback() {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (error) {
        setStatus("error");
        setErrorMessage(errorDescription || error || "Keycloak authentication failed");
        return;
      }

      if (!code) {
        setStatus("error");
        setErrorMessage("No authorization code received from Keycloak");
        return;
      }

      // Validate PKCE state
      const savedState = sessionStorage.getItem(PKCE_STATE_KEY);
      if (savedState && state && savedState !== state) {
        setStatus("error");
        setErrorMessage("Security state mismatch. Please initiate sign in again.");
        return;
      }

      const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY) || undefined;
      const targetRole = sessionStorage.getItem(TARGET_ROLE_KEY) as KeycloakAppRole | null;
      const redirectUri = `${window.location.origin}/auth/callback`;

      try {
        const res = await fetch("/api/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            code_verifier: verifier,
            redirect_uri: redirectUri,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus("error");
          setErrorMessage(data.error_description || "Token exchange with Keycloak failed");
          return;
        }

        // Store tokens & extract profile
        const user = saveAuthSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          id_token: data.id_token,
        });

        setUserName(user.name || user.username);
        setDetectedRoles(user.roles);

        // Determine destination portal
        let targetPortal = getDefaultPortalForRoles(user.roles);
        if (targetRole && user.roles.includes(targetRole)) {
          targetPortal = ROLE_CONFIGS[targetRole].route;
        }

        setDestination(targetPortal);
        setStatus("success");

        // Clean up temporary PKCE keys
        sessionStorage.removeItem(PKCE_STATE_KEY);
        sessionStorage.removeItem(PKCE_VERIFIER_KEY);
        sessionStorage.removeItem(TARGET_ROLE_KEY);

        // Auto-redirect after a smooth visual confirmation
        setTimeout(() => {
          router.replace(targetPortal);
        }, 1200);
      } catch (err: unknown) {
        setStatus("error");
        setErrorMessage(
          err instanceof Error ? err.message : "Unexpected connection error during login"
        );
      }
    }

    void processCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-[#0A1A2F] text-white flex flex-col items-center justify-center p-4">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header Branding */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-teal-400 to-[#092C4C] flex items-center justify-center text-white shadow-lg border border-teal-300/30">
            <Truck className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Waypoint Logistics
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-900/80 text-teal-300 border border-teal-700">
                Keycloak OIDC
              </span>
            </h1>
            <p className="text-xs text-slate-400">Intelligent Supply Chain Operations</p>
          </div>
        </div>

        <Card className="bg-slate-900/90 border-slate-800 shadow-2xl backdrop-blur-xl text-white">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-6">
            {status === "processing" && (
              <div className="space-y-4">
                <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-teal-500/20 border-t-teal-400 animate-spin" />
                  <Lock className="w-6 h-6 text-teal-400 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Verifying Identity</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Exchanging cryptographic authorization token with Keycloak realm...
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
                  Realm: waypointlogistics
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Authentication Successful</h2>
                  <p className="text-sm text-slate-300 mt-1">
                    Welcome back, <span className="font-semibold text-teal-300">{userName}</span>
                  </p>
                </div>

                {detectedRoles.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-slate-400 mb-2">Granted Keycloak Roles:</p>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {detectedRoles.map((role) => (
                        <span
                          key={role}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-teal-950 border border-teal-800 text-teal-300 uppercase tracking-wide"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    asChild
                    className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold shadow-md"
                  >
                    <Link href={destination} className="flex items-center justify-center gap-2">
                      <span>Entering Portal Now</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Sign-in Encountered an Issue</h2>
                  <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-900 rounded p-2.5 mt-2 font-mono break-all text-left">
                    {errorMessage}
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    asChild
                    variant="outline"
                    className="flex-1 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    <Link href="/login">Return to Sign In</Link>
                  </Button>
                  <Button
                    asChild
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    <Link href="/">Launchpad</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A1A2F] text-white flex items-center justify-center">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-teal-400" />
            <span className="text-sm font-medium">Loading session...</span>
          </div>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
