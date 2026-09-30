"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Truck, Lock, User } from "lucide-react";

export default function DriverLoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      {/* Status Bar */}
      <div className="flex justify-between items-center px-5 py-2" style={{ height: 34 }}>
        <span className="text-xs font-semibold" style={{ color: "#12202E" }}>06:58</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 rounded-sm border-2 border-current" style={{ color: "#12202E" }}>
            <div className="w-3/4 h-full rounded-sm" style={{ backgroundColor: "#27AE60" }} />
          </div>
        </div>
      </div>

      {/* Hero Header */}
      <div className="flex flex-col items-center justify-center pt-12 pb-8 px-6">
        <div
          className="flex items-center justify-center rounded-2xl mb-5"
          style={{ width: 80, height: 80, backgroundColor: "#163A5F" }}
        >
          <Truck size={40} color="#FFFFFF" />
        </div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: "#12202E" }}>
          Welcome Back
        </h1>
        <p className="text-sm text-center" style={{ color: "#5D6A78" }}>
          Sign in to your driver account
        </p>
      </div>

      {/* Login Card */}
      <div className="mx-4 flex-1">
        <div
          className="rounded-2xl p-5 flex flex-col gap-4"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #D9E1E8",
            boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)",
          }}
        >
          {/* Employee ID */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5D6A78" }}>
              Employee ID
            </label>
            <div
              className="flex items-center gap-3 rounded-xl px-4"
              style={{
                border: "1px solid #D9E1E8",
                backgroundColor: "#F2F5F8",
                height: 52,
              }}
            >
              <User size={18} color="#8793A0" />
              <input
                type="text"
                placeholder="Enter your employee ID"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#12202E" }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#5D6A78" }}>
              Password
            </label>
            <div
              className="flex items-center gap-3 rounded-xl px-4"
              style={{
                border: "1px solid #D9E1E8",
                backgroundColor: "#F2F5F8",
                height: 52,
              }}
            >
              <Lock size={18} color="#8793A0" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: "#12202E" }}
              />
              <button onClick={() => setShowPassword(!showPassword)} className="p-1">
                {showPassword
                  ? <EyeOff size={18} color="#8793A0" />
                  : <Eye size={18} color="#8793A0" />
                }
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="text-right">
            <span className="text-xs font-semibold" style={{ color: "#163A5F" }}>
              Forgot password?
            </span>
          </div>

          {/* Sign In Button */}
          <Link href="/driver">
            <button
              className="w-full flex items-center justify-center rounded-full font-semibold text-base"
              style={{
                backgroundColor: "#163A5F",
                color: "#FFFFFF",
                height: 52,
              }}
            >
              Sign In
            </button>
          </Link>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs mt-6 mb-8" style={{ color: "#8793A0" }}>
          Having trouble? Contact your dispatcher
        </p>
      </div>
    </div>
  );
}
