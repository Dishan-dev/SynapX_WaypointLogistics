"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Truck, ArrowRight, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDefaultPortalForRoles, KeycloakAppRole, ROLE_CONFIGS } from "@/lib/keycloak";

function LoginContent() {
  const { loginWithKeycloak, isAuthenticated, user, hasRole, logout, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const redirectUrl = searchParams.get("redirect") || searchParams.get("returnUrl") || "";
  const isAdminTarget = redirectUrl === "/admin" || redirectUrl.startsWith("/admin");
  const isDispatcherTarget = redirectUrl === "/dispatcher" || redirectUrl.startsWith("/dispatcher");
  const targetRole: KeycloakAppRole | undefined = isAdminTarget
    ? "admin"
    : isDispatcherTarget
    ? "dispatcher"
    : undefined;

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      if (isAdminTarget) {
        if (hasRole("admin")) {
          router.replace(redirectUrl || "/admin");
        }
        // If authenticated but not admin, stay here and present switch account option
        return;
      }
      if (isDispatcherTarget) {
        if (hasRole("dispatcher") || hasRole("admin")) {
          router.replace(redirectUrl || "/dispatcher");
        }
        // If authenticated but not dispatcher/admin, stay here and present switch option
        return;
      }
      router.replace(redirectUrl || getDefaultPortalForRoles(user.roles));
      return;
    }

    // Trigger Keycloak SSO redirect
    void loginWithKeycloak(targetRole, redirectUrl || undefined);
  }, [isAuthenticated, user, isLoading, hasRole, isAdminTarget, isDispatcherTarget, redirectUrl, router, loginWithKeycloak, targetRole]);

  // If authenticated but lacks admin or dispatcher privileges
  const lacksAdmin = isAdminTarget && !hasRole("admin");
  const lacksDispatcher = isDispatcherTarget && !hasRole("dispatcher") && !hasRole("admin");

  if (isAuthenticated && user && (lacksAdmin || lacksDispatcher)) {
    const userRoleLabels = user.roles.map((r) => ROLE_CONFIGS[r]?.label || r).join(", ") || "None";
    const myPortal = getDefaultPortalForRoles(user.roles);
    const requiredTitle = lacksAdmin ? "Administrator Access Required" : "Dispatcher Access Required";
    const requiredDescription = lacksAdmin
      ? "You are currently signed in with an account that does not have administrator privileges."
      : "You are currently signed in with an account that does not have dispatcher privileges.";
    const requiredRole: KeycloakAppRole = lacksAdmin ? "admin" : "dispatcher";
    const roleButtonLabel = lacksAdmin ? "Sign in as Administrator" : "Sign in as Dispatcher";

    return (
      <div className="min-h-screen bg-[#F6F7F9] text-slate-900 flex flex-col items-center justify-center p-4 font-sans antialiased">
        <Card className="max-w-md w-full border-slate-200 bg-white shadow-xl rounded-2xl overflow-hidden">
          <CardContent className="pt-8 pb-8 px-6 text-center space-y-5">
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{requiredTitle}</h1>
              <p className="text-xs text-slate-500 mt-1">
                {requiredDescription}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Account:</span>
                <span className="font-semibold text-slate-900">{user.email || user.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Role:</span>
                <span className="font-mono font-bold text-purple-700">{userRoleLabels}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => loginWithKeycloak(requiredRole, redirectUrl || (lacksAdmin ? "/admin" : "/dispatcher"))}
                className="w-full bg-[#092C4C] hover:bg-[#061e34] text-white flex items-center justify-center gap-2"
              >
                <span>{roleButtonLabel}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push(myPortal)}
                className="w-full border-slate-300 text-slate-700 hover:bg-slate-100"
              >
                <span>Go to My Workspace</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout(true)}
                className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <LogOut className="size-3.5 mr-1.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F7F9] text-slate-900 flex flex-col items-center justify-center p-4 font-sans antialiased">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="h-12 w-12 rounded-xl bg-[#092C4C] flex items-center justify-center text-white shadow-sm">
          <Truck className="h-6 w-6 text-white" />
        </div>
        <div className="relative mx-auto w-10 h-10 flex items-center justify-center mt-2">
          <div className="absolute inset-0 rounded-full border-3 border-slate-200 border-t-[#092C4C] animate-spin" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900">
            {isAdminTarget ? "Redirecting to Admin Sign-in" : "Redirecting to Waypoint Sign-in"}
          </h1>
          <p className="text-xs text-slate-500 mt-1">Connecting to Keycloak Single Sign-On...</p>
        </div>
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loginWithKeycloak(targetRole, redirectUrl || undefined)}
            className="text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Click here if not redirected automatically
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F6F7F9] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-[#092C4C] animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
