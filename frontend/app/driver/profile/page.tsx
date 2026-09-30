"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Truck, Phone, Mail, MapPin, Clock, Star, ChevronRight, Bell, Package } from "lucide-react";

const tripHistory = [
  { id: "TRIP-023", date: "29 Sep 2026", stops: 7, status: "Completed", rating: 5 },
  { id: "TRIP-021", date: "28 Sep 2026", stops: 5, status: "Completed", rating: 4 },
  { id: "TRIP-019", date: "27 Sep 2026", stops: 6, status: "Completed", rating: 5 },
];

export default function DriverProfilePage() {
  const [onDuty, setOnDuty] = useState(true);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      {/* Status Bar */}
      <div className="flex justify-between items-center px-5" style={{ height: 34, backgroundColor: "#163A5F" }}>
        <span className="text-xs font-semibold" style={{ color: "#DCEAF4" }}>06:58</span>
      </div>

      {/* Profile Header */}
      <div
        className="flex flex-col items-center pt-6 pb-8 px-5"
        style={{ backgroundColor: "#163A5F" }}
      >
        <div
          className="flex items-center justify-center rounded-full font-bold text-2xl mb-3"
          style={{ width: 80, height: 80, backgroundColor: "#FF6B00", color: "#FFFFFF", border: "4px solid rgba(255,255,255,0.2)" }}
        >
          MP
        </div>
        <h1 className="text-xl font-bold" style={{ color: "#FFFFFF" }}>Minidu Perera</h1>
        <p className="text-xs mt-1" style={{ color: "#8CC2FF" }}>Driver · EMP-20245</p>
        <div className="flex items-center gap-1.5 mt-3">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} size={14} color="#FF6B00" fill="#FF6B00" />
          ))}
          <span className="text-xs ml-1 font-semibold" style={{ color: "#DCEAF4" }}>4.8 rating</span>
        </div>

        {/* Status Toggle */}
        <button
          className="flex items-center gap-2 mt-4 px-5 py-2 rounded-full"
          style={{
            backgroundColor: onDuty ? "rgba(39,174,96,0.2)" : "rgba(201,54,62,0.2)",
            border: `1.5px solid ${onDuty ? "#27AE60" : "#C9363E"}`,
          }}
          onClick={() => setOnDuty(!onDuty)}
        >
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: onDuty ? "#27AE60" : "#C9363E" }} />
          <span className="text-xs font-semibold" style={{ color: onDuty ? "#27AE60" : "#C9363E" }}>
            {onDuty ? "On Duty" : "Off Duty"} — tap to toggle
          </span>
        </button>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4 pb-28">

        {/* Vehicle Info */}
        <div
          className="rounded-2xl p-4 flex items-center gap-3"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
        >
          <div className="flex items-center justify-center rounded-full" style={{ width: 44, height: 44, backgroundColor: "#EAF2FF" }}>
            <Truck size={20} color="#163A5F" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8793A0" }}>Assigned Vehicle</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "#12202E" }}>Isuzu NPR · WP-AB-1234</p>
            <p className="text-xs" style={{ color: "#5D6A78" }}>Capacity: 2000kg · Last inspection: 28 Sep</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Trips\nThis Week", value: "3" },
            { label: "Deliveries\nCompleted", value: "18" },
            { label: "On-Time\nRate", value: "96%" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl py-4 flex flex-col items-center gap-1"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
            >
              <span className="text-xl font-bold" style={{ color: "#163A5F" }}>{s.value}</span>
              <span className="text-[10px] text-center leading-tight" style={{ color: "#8793A0", whiteSpace: "pre-line" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
        >
          <div className="px-4 pt-3 pb-1">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#5D6A78" }}>CONTACT</span>
          </div>
          {[
            { icon: Phone, label: "+94 77 456 7890" },
            { icon: Mail, label: "minidu.perera@waypoint.lk" },
            { icon: MapPin, label: "Colombo, Sri Lanka" },
          ].map((c, idx) => (
            <React.Fragment key={c.label}>
              {idx > 0 && <div className="h-px mx-4" style={{ backgroundColor: "#D9E1E8" }} />}
              <div className="flex items-center gap-3 px-4 py-3">
                <c.icon size={15} color="#5D6A78" />
                <span className="text-sm" style={{ color: "#12202E" }}>{c.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Trip History */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wide mb-3 block" style={{ color: "#5D6A78" }}>RECENT TRIPS</span>
          <div className="flex flex-col gap-2">
            {tripHistory.map((trip) => (
              <div
                key={trip.id}
                className="rounded-2xl px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8" }}
              >
                <div>
                  <p className="text-sm font-bold" style={{ color: "#12202E" }}>{trip.id}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8793A0" }}>{trip.date} · {trip.stops} stops</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: trip.rating }).map((_, i) => (
                      <Star key={i} size={11} color="#FF6B00" fill="#FF6B00" />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#E8F6EF", color: "#18794E" }}>
                    {trip.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Menu Items */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
        >
          {[
            { label: "Change Password", icon: Clock },
            { label: "Notification Settings", icon: Bell },
            { label: "App Version 1.2.0", icon: Package },
          ].map((item, idx) => (
            <React.Fragment key={item.label}>
              {idx > 0 && <div className="h-px mx-4" style={{ backgroundColor: "#D9E1E8" }} />}
              <button className="w-full flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <item.icon size={15} color="#5D6A78" />
                  <span className="text-sm" style={{ color: "#12202E" }}>{item.label}</span>
                </div>
                <ChevronRight size={16} color="#D9E1E8" />
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Sign Out */}
        <Link href="/driver/login">
          <button
            className="w-full flex items-center justify-center rounded-full font-semibold text-sm"
            style={{ height: 52, backgroundColor: "#FDECEF", color: "#C9363E", border: "1px solid rgba(201,54,62,0.2)" }}
          >
            Sign Out
          </button>
        </Link>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-3"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0px -8px 28px 0px rgba(11,39,67,0.16)", height: 72 }}>
        {[
          { label: "Home", icon: Package, href: "/driver", active: false },
          { label: "Trip", icon: Truck, href: "/driver/trip", active: false },
          { label: "Notify", icon: Bell, href: "/driver/notifications", active: false },
          { label: "Profile", icon: MapPin, href: "/driver/profile", active: true },
        ].map((item) => (
          <Link href={item.href} key={item.label}>
            <div className="flex flex-col items-center gap-1" style={{ width: 72 }}>
              <item.icon size={22} color={item.active ? "#163A5F" : "#8793A0"} />
              <span className="text-[10px] font-medium" style={{ color: item.active ? "#163A5F" : "#8793A0" }}>{item.label}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
