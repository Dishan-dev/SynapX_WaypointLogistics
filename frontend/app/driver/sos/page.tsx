"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Phone, MapPin, CheckCircle2 } from "lucide-react";

type SOSState = "idle" | "confirming" | "sent";

export default function EmergencySOSPage() {
  const [sosState, setSosState] = useState<SOSState>("idle");
  const [holdProgress, setHoldProgress] = useState(0);

  const handleHoldStart = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setHoldProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        setSosState("sent");
        setHoldProgress(0);
      }
    }, 100);
    const onEnd = () => {
      clearInterval(interval);
      if (progress < 100) setHoldProgress(0);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
  };

  if (sosState === "sent") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#FDECEF", fontFamily: "Inter, sans-serif" }}>
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {/* Alert Sent Icon */}
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 96, height: 96, backgroundColor: "#FFFFFF", boxShadow: "0px 5px 24px rgba(201,54,62,0.2)" }}
          >
            <CheckCircle2 size={48} color="#C9363E" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold" style={{ color: "#12202E" }}>Emergency Alert Sent</h1>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: "#5D6A78" }}>
              The dispatcher has been notified and your current location has been shared.
            </p>
          </div>

          {/* Alert Details Card */}
          <div
            className="w-full rounded-2xl p-4 flex flex-col gap-3"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
          >
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#5D6A78" }}>ALERT DETAILS</span>
            {[
              { label: "Emergency", value: "SOS Triggered", color: "#C9363E" },
              { label: "Trip", value: "TRIP-024", color: "#12202E" },
              { label: "Vehicle", value: "WP-AB-1234", color: "#12202E" },
              { label: "Location", value: "Shared ✓", color: "#18794E" },
              { label: "Status", value: "Dispatcher Notified ✓", color: "#18794E" },
            ].map((row, idx) => (
              <React.Fragment key={row.label}>
                {idx > 0 && <div className="h-px" style={{ backgroundColor: "#D9E1E8" }} />}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#8793A0" }}>{row.label}</span>
                  <span className="text-xs font-bold" style={{ color: row.color }}>{row.value}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Actions */}
          <div className="w-full flex flex-col gap-3">
            <button
              className="w-full flex items-center justify-center gap-2 rounded-full font-semibold text-base"
              style={{ height: 52, backgroundColor: "#163A5F", color: "#FFFFFF" }}
            >
              <Phone size={18} />
              Call Dispatcher
            </button>
            <Link href="/driver">
              <button
                className="w-full text-center font-semibold text-sm"
                style={{ color: "#5D6A78", textDecoration: "underline" }}
              >
                Return to home
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      {/* Status Bar */}
      <div className="flex justify-between items-center px-5" style={{ height: 34, backgroundColor: "#FFFFFF" }}>
        <span className="text-xs font-semibold" style={{ color: "#12202E" }}>06:58</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3" style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #D9E1E8" }}>
        <Link href="/driver/trip">
          <button className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "#F2F5F8" }}>
            <ArrowLeft size={18} color="#163A5F" />
          </button>
        </Link>
        <span className="text-base font-bold" style={{ color: "#C9363E" }}>Emergency SOS</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-between px-6 py-8">

        {/* Warning Card */}
        <div
          className="w-full rounded-2xl p-4 flex items-start gap-3"
          style={{ backgroundColor: "#FDECEF", border: "1px solid rgba(201,54,62,0.2)" }}
        >
          <AlertTriangle size={20} color="#C9363E" className="mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold" style={{ color: "#C9363E" }}>Only for genuine emergencies</p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "#5D6A78" }}>
              Triggering a false alarm may result in disciplinary action. Use only when you are in real danger or need urgent help.
            </p>
          </div>
        </div>

        {/* SOS Button Area */}
        <div className="flex flex-col items-center gap-6 my-8">
          <div
            className="flex items-center justify-center rounded-2xl px-4 py-3"
            style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8" }}
          >
            <div className="flex items-center gap-2">
              <MapPin size={14} color="#18794E" />
              <span className="text-xs font-semibold" style={{ color: "#12202E" }}>Colombo 07 · Location shared</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E8F6EF", color: "#18794E" }}>Live</span>
            </div>
          </div>

          {/* Hold to SOS Button */}
          <div className="relative flex items-center justify-center">
            {/* Pulse rings */}
            <div
              className="absolute rounded-full animate-ping"
              style={{ width: 180, height: 180, backgroundColor: "rgba(201,54,62,0.1)", animationDuration: "1.5s" }}
            />
            <div
              className="absolute rounded-full"
              style={{ width: 160, height: 160, backgroundColor: "rgba(201,54,62,0.08)" }}
            />
            {/* Main button */}
            <button
              className="relative flex flex-col items-center justify-center rounded-full select-none"
              style={{
                width: 140, height: 140,
                backgroundColor: "#C9363E",
                color: "#FFFFFF",
                boxShadow: "0px 8px 32px rgba(201,54,62,0.4)",
                border: "4px solid rgba(255,255,255,0.3)",
              }}
              onMouseDown={handleHoldStart}
              onTouchStart={handleHoldStart}
            >
              {holdProgress > 0 ? (
                <>
                  <span className="text-4xl font-black">{holdProgress}%</span>
                  <span className="text-xs font-semibold mt-1">Hold...</span>
                </>
              ) : (
                <>
                  <span className="text-4xl font-black">SOS</span>
                  <span className="text-xs font-semibold mt-1">Hold to send</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-center" style={{ color: "#8793A0" }}>
            Hold the button for 2 seconds to send emergency alert
          </p>
        </div>

        {/* Alternative: Call dispatcher */}
        <div className="w-full flex flex-col gap-3">
          <div className="h-px" style={{ backgroundColor: "#D9E1E8" }} />
          <p className="text-xs text-center" style={{ color: "#8793A0" }}>Or contact support directly</p>
          <button
            className="w-full flex items-center justify-center gap-2 rounded-full font-semibold text-sm"
            style={{ height: 52, backgroundColor: "#EAF2FF", color: "#163A5F", border: "1px solid rgba(33,103,213,0.2)" }}
          >
            <Phone size={18} />
            Call Dispatcher
          </button>
        </div>
      </div>
    </div>
  );
}
