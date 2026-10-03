"use client";

import React, { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, Navigation, CloudOff, BatteryFull, Signal } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { signIn, signOutMessage } from "@/lib/driverSession";
import { useSyncContext } from "@/components/SyncProvider";
import DeviceClock, { useColomboClock } from "@/components/driver/DeviceClock";
import { greeting } from "@/lib/colomboTime";

const noSubscription = () => () => {};

export default function DriverLoginPage() {
  const clock = useColomboClock();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { online } = useSyncContext();
  // Why the app logged the driver out (expired, turned off, not a driver), if it did.
  const signedOut = useSyncExternalStore(noSubscription, signOutMessage, () => null);

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/driver");
    }
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // The email and password the depot admin gave this driver.
      router.push(await signIn(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col font-sans" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      {/* Hero Section */}
      <div 
        className="flex flex-col relative w-full"
        style={{
          background: "linear-gradient(180deg, rgba(10, 30, 58, 1) 0%, rgba(13, 37, 69, 1) 40%, rgba(18, 45, 82, 1) 70%, rgba(22, 58, 95, 1) 100%)",
          paddingBottom: "40px"
        }}
      >
        {/* Device Status Bar */}
        <div className="flex justify-between items-center px-5 py-3 h-11 w-full text-white">
          <DeviceClock className="text-xs font-semibold" />
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/20 px-2 py-0.5 rounded text-[10px] font-medium">
              {online ? "Online" : "Offline"}
            </div>
            <Signal size={14} />
            <BatteryFull size={18} />
          </div>
        </div>

        {/* Brand */}
        <div className="flex items-center px-5 gap-2.5 mt-2 h-11 w-full">
          <div 
            className="flex justify-center items-center rounded-xl w-9 h-9 shrink-0"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.15)", border: "1px solid rgba(255, 255, 255, 0.25)" }}
          >
            <Navigation size={18} color="#FFFFFF" />
          </div>
          <span className="text-white font-extrabold text-xl tracking-[0.09em]">WAYPOINT</span>
        </div>

        {/* Hero Copy */}
        <div className="flex flex-col px-5 mt-10 mb-8 max-w-[320px] gap-2">
          <span className="font-bold text-[10px] tracking-[0.12em]" style={{ color: "#8CC2FF" }}>
            DRIVER PORTAL
          </span>
          <div className="flex flex-col">
            <span className="font-bold text-[32px] leading-[1.1em]" style={{ color: "rgba(255, 255, 255, 0.82)" }}>
              {greeting(clock)},
            </span>
            <span className="font-extrabold text-[40px] leading-[1.05em] text-white">
              Driver.
            </span>
          </div>
          <span className="font-semibold text-lg leading-[1.25em] mt-1" style={{ color: "#8CC2FF" }}>
            Ready for today&apos;s run?
          </span>
          <span className="font-regular text-[13px] leading-[1.5em]" style={{ color: "rgba(255, 255, 255, 0.69)" }}>
            Sign in to view your assigned<br/>trips and delivery records.
          </span>
        </div>
      </div>

      {/* Login Card */}
      <form
        onSubmit={handleLogin}
        className="flex flex-col flex-1 px-5 pt-7 pb-5 gap-5 -mt-6 z-10"
        style={{
          backgroundColor: "#FFFFFF",
          boxShadow: "0px -8px 28px 0px rgba(11, 39, 67, 0.25)"
        }}
      >
        {/* Handle */}
        <div className="flex justify-center w-full">
          <div className="w-9 h-1 rounded-full" style={{ backgroundColor: "#D9E1E8" }}></div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="flex items-center px-3.5 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ backgroundColor: "#FEF2F2", border: "1px solid #FECACA", color: "#C9363E" }}
          >
            {error}
          </div>
        )}

        {/* Why the app logged the driver out */}
        {signedOut && !error && (
          <div
            role="status"
            className="flex items-center px-3.5 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ backgroundColor: "#EAF2FF", border: "1px solid rgba(33, 103, 213, 0.21)", color: "#2167D5" }}
          >
            {signedOut}
          </div>
        )}

        {/* Fields */}
        <div className="flex flex-col w-full gap-[14px]">
          {/* Email: the login the depot admin created */}
          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="driver-username" className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "#5D6A78" }}>
              Email
            </label>
            <div 
              className="flex items-center gap-2.5 px-3.5 h-[52px] rounded-xl w-full"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8" }}
            >
              <Mail size={18} color="#6B7280" />
              <input
                id="driver-username"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="name@waypoint.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="flex-1 bg-transparent outline-none text-[13px] placeholder-[#6B7280]"
                style={{ color: "#111827" }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5 w-full">
            <label htmlFor="driver-password" className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "#5D6A78" }}>
              Password
            </label>
            <div 
              className="flex items-center gap-2.5 px-3.5 h-[52px] rounded-xl w-full"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8" }}
            >
              <Lock size={18} color="#6B7280" />
              <input
                id="driver-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="flex-1 bg-transparent outline-none text-[13px] placeholder-[#6B7280]"
                style={{ color: "#111827" }}
              />
              <button onClick={() => setShowPassword(!showPassword)} type="button" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <Eye size={18} color="#6B7280" /> : <EyeOff size={18} color="#6B7280" />}
              </button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col w-full gap-2.5 mt-1">
          <button
            id="driver-login-btn"
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center h-[54px] rounded-xl text-white font-bold text-base disabled:opacity-60"
            style={{ backgroundColor: "#092C4C" }}
          >
            {loading ? "Signing in…" : "Log in →"}
          </button>
        </div>
      </form>

      {/* Offline Info */}
      <div className="flex flex-col px-5 pb-7 pt-2 w-full" style={{ backgroundColor: "#F2F5F8" }}>
        <div 
          className="flex flex-row p-3 gap-2.5 rounded-xl w-full"
          style={{ backgroundColor: "#EAF2FF", border: "1px solid rgba(33, 103, 213, 0.21)" }}
        >
          <CloudOff size={18} color="#2167D5" className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="font-bold text-[13px] leading-[1.45em]" style={{ color: "#2167D5" }}>
              Works offline once signed in
            </span>
            <span className="font-normal text-[12px] leading-[1.55em]" style={{ color: "#2167D5" }}>
              Your assigned trips and delivery records<br/>are saved on this device and will sync<br/>automatically when you&apos;re back online.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

