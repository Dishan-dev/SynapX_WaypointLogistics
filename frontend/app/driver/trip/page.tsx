"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, MapPin, Clock, ChevronRight,
  Package, Phone, AlertTriangle
} from "lucide-react";

const stops = [
  { id: 1, name: "Waypoint Express #12", address: "45 Galle Road, Colombo 03", status: "done", time: "09:10 AM" },
  { id: 2, name: "Waypoint Express #18", address: "112 Union Place, Colombo 02", status: "done", time: "09:42 AM" },
  { id: 3, name: "Waypoint Express #42", address: "78 Orchard Blvd, Colombo 07", status: "active", time: "10:45 AM" },
  { id: 4, name: "Waypoint Express #55", address: "33 Flower Road, Colombo 07", status: "pending", time: "11:20 AM" },
  { id: 5, name: "Colombo Fort Depot", address: "Fort Railway Station Rd", status: "pending", time: "12:00 PM" },
];

export default function ActiveTripPage() {
  const [showMap, setShowMap] = useState(true);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      {/* Status Bar */}
      <div className="flex justify-between items-center px-5" style={{ height: 34, backgroundColor: "#FFFFFF" }}>
        <span className="text-xs font-semibold" style={{ color: "#12202E" }}>06:58</span>
        <span className="text-xs" style={{ color: "#8793A0" }}>Synced</span>
      </div>

      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #D9E1E8" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/driver">
            <button className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "#F2F5F8" }}>
              <ArrowLeft size={18} color="#163A5F" />
            </button>
          </Link>
          <span className="text-base font-bold" style={{ color: "#163A5F" }}>Active Trip</span>
        </div>
        <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: "#EAF2FF", color: "#2167D5" }}>
          In Progress
        </span>
      </div>

      {/* Map Simulation */}
      {showMap && (
        <div
          className="relative mx-4 mt-4 rounded-2xl overflow-hidden"
          style={{ height: 220, backgroundColor: "#E1E6EB", border: "1px solid #D9E1E8" }}
        >
          {/* Simulated roads */}
          <div className="absolute inset-0">
            <div className="absolute" style={{ top: "40%", left: 0, right: 0, height: 6, backgroundColor: "#FFFFFF" }} />
            <div className="absolute" style={{ top: 0, bottom: 0, left: "30%", width: 6, backgroundColor: "#FFFFFF" }} />
            <div className="absolute" style={{ top: 0, bottom: 0, left: "72%", width: 6, backgroundColor: "#FFFFFF" }} />
            {/* Route highlight */}
            <div className="absolute" style={{ top: "40%", left: "30%", width: "42%", height: 6, backgroundColor: "#2167D5" }} />
          </div>
          {/* Current location dot */}
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{ top: "calc(40% - 12px)", left: "calc(30% - 12px)", width: 24, height: 24, backgroundColor: "#2167D5", border: "3px solid #FFFFFF", boxShadow: "0 0 0 4px rgba(33,103,213,0.2)" }}
          />
          {/* Destination pin */}
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{ top: "calc(40% - 16px)", left: "calc(72% - 16px)", width: 32, height: 32, backgroundColor: "#FF6B00", border: "3px solid #FFFFFF" }}
          >
            <MapPin size={14} color="#FFFFFF" />
          </div>
          {/* SOS FAB */}
          <Link href="/driver/sos">
            <button
              className="absolute bottom-3 right-3 flex items-center justify-center rounded-full font-black text-sm"
              style={{ width: 54, height: 54, backgroundColor: "#C9363E", color: "#FFFFFF", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.2)" }}
            >
              SOS
            </button>
          </Link>
          {/* Toggle map button */}
          <button
            className="absolute bottom-3 left-3 rounded-full text-xs font-semibold px-3 py-1"
            style={{ backgroundColor: "#FFFFFF", color: "#163A5F", boxShadow: "0px 2px 8px rgba(0,0,0,0.1)" }}
            onClick={() => setShowMap(false)}
          >
            Hide map
          </button>
        </div>
      )}

      {/* Trip Info Banner */}
      <div
        className="mx-4 mt-3 rounded-2xl px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
      >
        <div>
          <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8793A0" }}>TRIP-024</span>
          <p className="text-sm font-bold mt-0.5" style={{ color: "#12202E" }}>Stop 3 of 5</p>
          <div className="flex items-center gap-1 mt-1">
            <Clock size={11} color="#5D6A78" />
            <span className="text-xs" style={{ color: "#5D6A78" }}>ETA 10:45 AM · 8 mins away</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            className="flex items-center justify-center rounded-full"
            style={{ width: 40, height: 40, backgroundColor: "#EAF2FF" }}
          >
            <Phone size={16} color="#163A5F" />
          </button>
          <Link href={`/driver/trip/TRIP-024`}>
            <button
              className="flex items-center justify-center rounded-full"
              style={{ width: 40, height: 40, backgroundColor: "#163A5F" }}
            >
              <ChevronRight size={18} color="#FFFFFF" />
            </button>
          </Link>
        </div>
      </div>

      {/* Stops List */}
      <div className="mx-4 mt-4 flex flex-col gap-2 pb-28">
        <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#5D6A78" }}>Delivery Stops</span>
        {stops.map((stop) => (
          <div
            key={stop.id}
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: stop.status === "active" ? "#EAF2FF" : "#FFFFFF",
              border: `1px solid ${stop.status === "active" ? "#2167D5" : "#D9E1E8"}`,
              boxShadow: "0px 2px 8px 0px rgba(22,58,95,0.06)",
            }}
          >
            {/* Stop indicator */}
            <div
              className="flex items-center justify-center rounded-full shrink-0"
              style={{
                width: 32, height: 32,
                backgroundColor:
                  stop.status === "done" ? "#E8F6EF" :
                  stop.status === "active" ? "#163A5F" : "#F2F5F8",
              }}
            >
              {stop.status === "done"
                ? <span style={{ color: "#18794E", fontSize: 14 }}>✓</span>
                : stop.status === "active"
                ? <span className="text-xs font-bold" style={{ color: "#FFFFFF" }}>{stop.id}</span>
                : <span className="text-xs font-bold" style={{ color: "#8793A0" }}>{stop.id}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold truncate"
                style={{ color: stop.status === "done" ? "#8793A0" : "#12202E", textDecoration: stop.status === "done" ? "line-through" : "none" }}
              >
                {stop.name}
              </p>
              <p className="text-xs truncate" style={{ color: "#8793A0" }}>{stop.address}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold" style={{ color: stop.status === "active" ? "#2167D5" : "#8793A0" }}>{stop.time}</p>
              {stop.status === "active" && (
                <Link href="/driver/pod">
                  <span className="text-[10px] font-bold" style={{ color: "#163A5F" }}>POD →</span>
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-3"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0px -8px 28px 0px rgba(11,39,67,0.16)", height: 72 }}
      >
        {[
          { label: "Home", icon: Package, href: "/driver", active: false },
          { label: "Trip", icon: MapPin, href: "/driver/trip", active: true },
          { label: "Notify", icon: AlertTriangle, href: "/driver/notifications", active: false },
          { label: "Profile", icon: Clock, href: "/driver/profile", active: false },
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
