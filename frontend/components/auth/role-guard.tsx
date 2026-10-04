"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Lock, ArrowRight, UserCheck, RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { KeycloakAppRole, ROLE_CONFIGS, getDefaultPortalForRoles } from "@/lib/keycloak";

interface RoleGuardProps {
  allowedRoles: KeycloakAppRole[];
  children: React.ReactNode;
  fallbackTitle?: string;
}

export function RoleGuard({
  allowedRoles,
  children,
  fallbackTitle = "Access Restricted",
}: RoleGuardProps) {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, loginWithKeycloak, logout } = useAuth();

  // Auto-redirect to Keycloak login if not authenticated
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !user)) {
      const currentUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
      const targetRole = allowedRoles.length === 1 ? allowedRoles[0] : undefined;
      void loginWithKeycloak(targetRole, currentUrl);
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, loginWithKeycloak]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F6F7F9] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-10 w-10 rounded-full border-3 border-slate-200 border-t-[#092C4C] animate-spin" />
          <p className="text-sm font-semibold text-slate-800">Verifying Security Credentials...</p>
          <p className="text-xs text-slate-500">Checking Keycloak IAM permissions</p>
        </div>
      </div>
    );
  }

  // Not authenticated: show redirecting card with manual sign-in fallback
  if (!isAuthenticated || !user) {
    const currentUrl = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    const targetRole = allowedRoles.length === 1 ? allowedRoles[0] : undefined;

    return (
      <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-slate-200 bg-white shadow-xl rounded-2xl text-center overflow-hidden">
          <CardHeader className="pb-2 pt-6">
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 flex items-center justify-center mx-auto mb-2">
              <Lock className="w-6 h-6 text-[#092C4C]" />
            </div>
            <CardTitle className="text-lg font-bold text-slate-900">Sign In Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-1 pb-6 px-6">
            <p className="text-xs text-slate-600">
              Access to this console requires an active Waypoint corporate account. Redirecting you to Single Sign-On...
            </p>
            <div className="pt-2">
              <Button
                onClick={() => void loginWithKeycloak(targetRole, currentUrl)}
                className="w-full bg-[#092C4C] hover:bg-[#061e34] text-white flex items-center justify-center gap-2 text-xs font-semibold py-2"
              >
                <span>Continue to Keycloak Sign-In</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has ANY of the allowed roles
  const hasAccess = allowedRoles.some((role) => user.roles.includes(role));

  if (!hasAccess) {
    const userRoleLabels = user.roles.map((r) => ROLE_CONFIGS[r]?.label || r).join(", ") || "None";
    const allowedLabels = allowedRoles.map((r) => ROLE_CONFIGS[r]?.label || r).join(" or ");
    const userPrimaryPortal = getDefaultPortalForRoles(user.roles);

    return (
      <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center p-4 font-sans">
        <Card className="max-w-lg w-full border-amber-200 bg-white shadow-2xl rounded-2xl overflow-hidden">
          <div className="bg-amber-500/10 border-b border-amber-500/20 py-3 px-6 flex items-center gap-2.5 text-amber-900">
            <ShieldAlert className="size-5 text-amber-600 shrink-0" />
            <span className="font-semibold text-xs tracking-tight">Security Access Control</span>
          </div>

          <CardHeader className="pt-6 pb-2 text-center">
            <CardTitle className="text-xl font-bold text-slate-900">{fallbackTitle}</CardTitle>
            <p className="text-xs text-slate-600 mt-1">
              This console requires the <strong className="text-slate-900">{allowedLabels}</strong> Keycloak realm role.
            </p>
          </CardHeader>

          <CardContent className="space-y-4 pt-2 pb-6 px-6 text-center">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Signed In As:</span>
                <span className="font-semibold text-slate-900">{user.name || user.username}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Email Address:</span>
                <span className="font-mono text-slate-700">{user.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Assigned Role:</span>
                <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  {userRoleLabels}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <Button asChild className="w-full bg-[#092C4C] hover:bg-[#061e34] text-white text-xs font-semibold">
                <Link href={userPrimaryPortal}>
                  <UserCheck className="size-4 mr-1.5" />
                  <span>Return to My Portal</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                onClick={() => logout(true)}
                className="w-full border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
              >
                <LogOut className="size-3.5 mr-1.5" />
                <span>Switch Account</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
