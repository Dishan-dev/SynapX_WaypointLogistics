"use client";

import React, { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  Truck,
  ShieldCheck,
  ArrowRight,
  Lock,
  Building2,
  Navigation,
  ScanBarcode,
  LogOut,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getDefaultPortalForRoles,
  KeycloakAppRole,
  ROLE_CONFIGS,
  APP_ROLES,
} from "@/lib/keycloak";

function InternalLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithKeycloak, isAuthenticated, user, isLoading, logout } = useAuth();

  const [isRedirecting, setIsRedirecting] = useState(false);

  const redirectUrl = searchParams.get("redirect") || searchParams.get("returnUrl") || "";

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      const destination = redirectUrl || getDefaultPortalForRoles(user.roles);
      const timer = setTimeout(() => {
        router.replace(destination);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, user, redirectUrl, router]);

  const handleSignIn = async (role?: KeycloakAppRole) => {
    setIsRedirecting(true);
    try {
      await loginWithKeycloak(role, redirectUrl || undefined);
    } catch (err) {
      console.error("SSO Login initiation failed:", err);
      setIsRedirecting(false);
    }
  };

  const getRoleIcon = (roleId: KeycloakAppRole) => {
    switch (roleId) {
      case "admin":
        return <ShieldCheck className="h-4 w-4 text-purple-600" />;
      case "dispatcher":
        return <Truck className="h-4 w-4 text-blue-600" />;
      case "driver":
        return <Navigation className="h-4 w-4 text-indigo-600" />;
      case "loader":
        return <ScanBarcode className="h-4 w-4 text-teal-600" />;
      case "store_manager":
        return <Store className="h-4 w-4 text-amber-600" />;
      default:
        return <Lock className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900 font-sans flex flex-col justify-between antialiased">
      {/* Top Application Header */}
      <header className="w-full border-b border-slate-200 bg-white/95 backdrop-blur-md px-6 py-3.5 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/waypoint-logo.png"
              alt="Waypoint Logistics"
              width={160}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
              SynapX
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>SSO Active</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Login Workspace */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="max-w-md w-full">
          {/* Main Card */}
          <Card className="border border-slate-200/90 bg-white shadow-xl rounded-2xl overflow-hidden">
            {/* Top Corporate Navy Bar */}
            <div className="h-1.5 w-full bg-[#092C4C]" />

            {/* Authenticated State */}
            {isAuthenticated && user ? (
              <CardContent className="pt-8 pb-8 px-6 sm:px-8 text-center space-y-6">
                <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-200 text-[#092C4C] flex items-center justify-center mx-auto shadow-xs">
                  <CheckCircle2 className="h-7 w-7 text-blue-600" />
                </div>

                <div className="space-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    Active Session Detected
                  </h1>
                  <p className="text-xs text-slate-500">
                    Signed in to Waypoint Identity Services
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">User:</span>
                    <span className="font-semibold text-slate-900">
                      {user.name || user.username || user.email}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Assigned Role:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {user.roles.map((r) => ROLE_CONFIGS[r]?.label || r).join(", ") || "Standard Staff"}
                    </span>
                  </div>
                  {user.assigned_depot && (
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 font-medium">Depot Scope:</span>
                      <span className="font-semibold text-slate-800 uppercase">
                        {user.assigned_depot}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-2">
                  <Button
                    id="btn-enter-workspace"
                    onClick={() => {
                      const dest = redirectUrl || getDefaultPortalForRoles(user.roles);
                      router.push(dest);
                    }}
                    className="w-full bg-[#092C4C] hover:bg-[#061e34] text-white font-medium shadow-md shadow-[#092C4C]/20 h-11 rounded-xl flex items-center justify-center gap-2"
                  >
                    <span>Enter Operational Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </Button>

                  <Button
                    id="btn-sign-out-switch"
                    variant="outline"
                    onClick={() => logout(true)}
                    className="w-full border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 h-10 rounded-xl text-xs flex items-center justify-center gap-2"
                  >
                    <LogOut className="h-3.5 w-3.5 text-slate-500" />
                    <span>Sign Out / Switch Account</span>
                  </Button>
                </div>
              </CardContent>
            ) : (
              /* Unauthenticated State: Enterprise Login */
              <div className="p-6 sm:p-8 space-y-6">
                {/* Brand Header inside Card */}
                <div className="text-center space-y-3">
                  <div className="flex justify-center">
                    <Image
                      src="/waypoint-logo.png"
                      alt="Waypoint Logistics"
                      width={210}
                      height={52}
                      className="h-10 w-auto object-contain"
                      priority
                    />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold tracking-tight text-slate-900">
                      Internal Operations Portal
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                      Authorized enterprise authentication for Waypoint supply chain &amp; fleet consoles
                    </p>
                  </div>
                </div>

                {/* Primary Keycloak Sign-In Button */}
                <div className="space-y-3 pt-1">
                  <Button
                    id="btn-keycloak-sso-login"
                    disabled={isRedirecting || isLoading}
                    onClick={() => handleSignIn()}
                    className="w-full bg-[#092C4C] hover:bg-[#061e34] text-white font-semibold shadow-md shadow-[#092C4C]/20 h-11 rounded-xl flex items-center justify-center gap-2.5 transition-all"
                  >
                    {isRedirecting || isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                        <span>Connecting to Keycloak SSO...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>Sign In with Waypoint Identity</span>
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>

                  {/* Informative Workspace Roles Section */}
                  <div className="pt-3">
                    <div className="flex items-center gap-2 mb-2.5 select-none">
                      <div className="h-px bg-slate-200 flex-1" />
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Workspace Roles
                      </span>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 select-none">
                      {APP_ROLES.filter((r) => r !== "admin").map((roleKey) => {
                        const cfg = ROLE_CONFIGS[roleKey];
                        return (
                          <div
                            key={roleKey}
                            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/90 bg-slate-50/70 text-slate-700 text-xs cursor-default"
                          >
                            <span className="shrink-0">{getRoleIcon(roleKey)}</span>
                            <span className="truncate font-medium">{cfg.label}</span>
                          </div>
                        );
                      })}

                      {/* Admin Portal Indicator */}
                      <div
                        className="col-span-2 flex items-center justify-between p-2.5 rounded-xl border border-purple-200/80 bg-purple-50/50 text-purple-900 text-xs cursor-default"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="h-4 w-4 text-purple-600" />
                          <span className="font-medium">System Administrator Console</span>
                        </div>
                        <Badge
                          variant="outline"
                          className="border-purple-300 text-purple-700 bg-white text-[10px] py-0 font-medium"
                        >
                          Root Admin
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Restricted Access Warning */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong className="text-slate-800 font-semibold">Authorized Personnel Only:</strong> Access is restricted to Waypoint Logistics staff. Unauthorized access is audited and strictly prohibited.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Security and Realm Telemetry Badge */}
          <div className="mt-4 text-center">
            <p className="text-[11px] text-slate-600 font-mono">
              Keycloak Realm: <span className="font-semibold text-slate-700">waypointlogistics</span> • TLS 1.3
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-200 bg-white px-6 py-4 text-center">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <div>
            &copy; {new Date().getFullYear()} Waypoint Logistics Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <span>Corporate Network</span>
            <span>&bull;</span>
            <span>Security Policy</span>
            <span>&bull;</span>
            <span>SynapX Platform v2.4</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function RootHomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F7F9] text-slate-900 flex items-center justify-center font-sans">
          <div className="flex flex-col items-center gap-3">
            <Image
              src="/waypoint-logo.png"
              alt="Waypoint Logistics"
              width={160}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
            <div className="h-6 w-6 border-2 border-slate-300 border-t-[#092C4C] rounded-full animate-spin" />
            <span className="text-xs text-slate-500 font-mono">Connecting to Waypoint SSO...</span>
          </div>
        </div>
      }
    >
      <InternalLoginContent />
    </Suspense>
  );
}
