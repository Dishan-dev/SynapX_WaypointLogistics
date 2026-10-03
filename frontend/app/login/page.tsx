"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { RefreshCw } from "lucide-react";

export default function LoginPage() {
  const { loginWithKeycloak, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      void loginWithKeycloak();
    }
  }, [isAuthenticated, loginWithKeycloak]);

  return (
    <div className="min-h-screen bg-[#092C4C] text-white flex flex-col items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-teal-400" />
        <h1 className="text-xl font-bold tracking-tight">Redirecting to Keycloak...</h1>
        <p className="text-sm text-slate-300">Taking you to the Waypoint Logistics sign-in page</p>
      </div>
    </div>
  );
}
