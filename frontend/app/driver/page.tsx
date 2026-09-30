"use client";

import React from "react";
import Link from "next/link";
import {
  MapPin, Bell, Package, CheckCircle2, Clock,
  AlertTriangle, ChevronRight, Navigation, Truck
} from "lucide-react";

const trips = [
  {
    id: "TRIP-024",
    status: "In Progress",
    statusColor: "#2167D5",
    statusBg: "#EAF2FF",
    stops: 6,
    totalStops: 8,
    destination: "Colombo Fort Depot",
    eta: "10:45 AM",
    vehicle: "WP-AB-1234",
  },
];

const stats = [
  { label: "Trips Today", value: "3", icon: Truck, color: "#163A5F", bg: "#EAF2FF" },
  { label: "Delivered", value: "18", icon: CheckCircle2, color: "#18794E", bg: "#E8F6EF" },
  { label: "Pending", value: "6", icon: Clock, color: "#A85D00", bg: "#FFF4D6" },
  { label: "Alerts", value: "1", icon: AlertTriangle, color: "#C9363E", bg: "#FDECEF" },
];

export default function DriverDashboard() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      {/* Status Bar */}
      <div className="flex justify-between items-center px-5" style={{ height: 34 }}>
        <span className="text-xs font-semibold" style={{ color: "#12202E" }}>06:58</span>
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ backgroundColor: "#163A5F" }}
      >
        <div>
          <p className="text-xs mb-0.5" style={{ color: "#8CC2FF" }}>Good morning</p>
          <h1 className="text-lg font-bold" style={{ color: "#FFFFFF" }}>Minidu Perera</h1>
          <div className="flex items-center gap-1 mt-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "#27AE60" }} />
            <span className="text-xs" style={{ color: "#DCEAF4" }}>On Duty · WP-AB-1234</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/driver/notifications">
            <button
              className="relative flex items-center justify-center rounded-full"
              style={{ width: 38, height: 38, backgroundColor: "rgba(255,255,255,0.12)" }}
            >
              <Bell size={18} color="#FFFFFF" />
              <span
                className="absolute top-1 right-1 w-2 h-2 rounded-full"
                style={{ backgroundColor: "#C9363E", border: "2px solid #163A5F" }}
              />
            </button>
          </Link>
          <Link href="/driver/profile">
            <div
              className="flex items-center justify-center rounded-full font-bold text-sm"
              style={{ width: 38, height: 38, backgroundColor: "#FF6B00", color: "#FFFFFF" }}
            >
              MP
            </div>
          </Link>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4 pb-24">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-1 rounded-xl py-3"
              style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
            >
              <div className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: s.bg }}>
                <s.icon size={14} color={s.color} />
              </div>
              <span className="text-base font-bold" style={{ color: "#12202E" }}>{s.value}</span>
              <span className="text-[9px] text-center leading-tight" style={{ color: "#8793A0" }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Active Trip Card */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#5D6A78" }}>Active Trip</span>
            <Link href="/driver/trip">
              <span className="text-xs font-semibold flex items-center gap-0.5" style={{ color: "#163A5F" }}>
                View all <ChevronRight size={12} />
              </span>
            </Link>
          </div>

          {trips.map((trip) => (
            <Link href={`/driver/trip/${trip.id}`} key={trip.id}>
              <div
                className="rounded-2xl p-4 flex flex-col gap-3"
                style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold" style={{ color: "#12202E" }}>{trip.id}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-1 rounded-full"
                    style={{ backgroundColor: trip.statusBg, color: trip.statusColor }}
                  >
                    {trip.status}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs" style={{ color: "#8793A0" }}>
                    <span>Stop {trip.stops} of {trip.totalStops}</span>
                    <span>{Math.round((trip.stops / trip.totalStops) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "#D9E1E8" }}>
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${(trip.stops / trip.totalStops) * 100}%`, backgroundColor: "#163A5F" }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs" style={{ color: "#5D6A78" }}>
                  <MapPin size={12} color="#163A5F" />
                  <span>{trip.destination}</span>
                  <span style={{ color: "#D9E1E8" }}>·</span>
                  <Clock size={12} />
                  <span>ETA {trip.eta}</span>
                </div>

                <Link href="/driver/trip">
                  <button
                    className="w-full flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-sm"
                    style={{ backgroundColor: "#163A5F", color: "#FFFFFF" }}
                  >
                    <Navigation size={16} />
                    Continue Trip
                  </button>
                </Link>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wide mb-2 block" style={{ color: "#5D6A78" }}>Quick Actions</span>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "POD", icon: Package, href: "/driver/pod", color: "#163A5F", bg: "#EAF2FF" },
              { label: "Notifications", icon: Bell, href: "/driver/notifications", color: "#A85D00", bg: "#FFF4D6" },
              { label: "SOS", icon: AlertTriangle, href: "/driver/sos", color: "#C9363E", bg: "#FDECEF" },
            ].map((a) => (
              <Link href={a.href} key={a.label}>
                <div
                  className="flex flex-col items-center gap-2 rounded-2xl py-4"
                  style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
                >
                  <div className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: a.bg }}>
                    <a.icon size={18} color={a.color} />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: "#12202E" }}>{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-3"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0px -8px 28px 0px rgba(11,39,67,0.16)", height: 72 }}
      >
        {[
          { label: "Home", icon: Truck, href: "/driver", active: true },
          { label: "Trip", icon: Navigation, href: "/driver/trip", active: false },
          { label: "Notify", icon: Bell, href: "/driver/notifications", active: false },
          { label: "Profile", icon: MapPin, href: "/driver/profile", active: false },
        ].map((item) => (
          <Link href={item.href} key={item.label}>
            <div className="flex flex-col items-center gap-1" style={{ width: 72 }}>
              <item.icon size={22} color={item.active ? "#163A5F" : "#8793A0"} />
              <span className="text-[10px] font-medium" style={{ color: item.active ? "#163A5F" : "#8793A0" }}>
                {item.label}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
