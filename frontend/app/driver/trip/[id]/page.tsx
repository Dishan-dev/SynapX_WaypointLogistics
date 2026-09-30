"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Truck, Package, Phone, ChevronRight } from "lucide-react";

export default function TripDetailsPage() {
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
        <div>
          <span className="text-base font-bold" style={{ color: "#163A5F" }}>Trip Details</span>
          <p className="text-xs" style={{ color: "#8793A0" }}>TRIP-024</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4 pb-24">

        {/* Trip Summary Card */}
        <div
          className="rounded-2xl p-4 flex flex-col gap-3"
          style={{ backgroundColor: "#FFFFFF", border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22,58,95,0.08)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#8793A0" }}>TRIP SUMMARY</span>
            <span className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ backgroundColor: "#EAF2FF", color: "#2167D5" }}>In Progress</span>
          </div>
          {[
            { label: "Trip ID", value: "TRIP-024", icon: Package },
            { label: "Vehicle", value: "WP-AB-1234", icon: Truck },
            { label: "Start Time", value: "08:30 AM", icon: Clock },
            { label: "ETA at Depot", value: "12:00 PM", icon: MapPin },
            { label: "Total Stops", value: "5 stops", icon: ChevronRight },
          ].map((row) => (
            <React.Fragment key={row.label}>
              <div className="h-px" style={{ backgroundColor: "#D9E1E8" }} />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <row.icon size={14} color="#8793A0" />
                  <span className="text-xs" style={{ color: "#8793A0" }}>{row.label}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: "#12202E" }}>{row.value}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Dispatcher Contact */}
        <div
          className="rounded-2xl p-4 flex items-center justify-between"
          style={{ backgroundColor: "#EAF2FF", border: "1px solid rgba(33,103,213,0.2)" }}
        >
          <div>
            <p className="text-xs font-bold" style={{ color: "#163A5F" }}>Dispatcher on duty</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: "#12202E" }}>Kavinda Jayasuriya</p>
            <p className="text-xs mt-0.5" style={{ color: "#5D6A78" }}>+94 77 123 4567</p>
          </div>
          <button
            className="flex items-center justify-center rounded-full"
            style={{ width: 44, height: 44, backgroundColor: "#163A5F" }}
          >
            <Phone size={18} color="#FFFFFF" />
          </button>
        </div>

        {/* Delivery Stops */}
        <div>
          <span className="text-xs font-bold uppercase tracking-wide mb-3 block" style={{ color: "#5D6A78" }}>Delivery Stops</span>
          <div className="flex flex-col gap-2">
            {[
              { num: 1, name: "Waypoint Express #12", addr: "45 Galle Rd, Colombo 03", status: "done", time: "09:10 AM", items: 4 },
              { num: 2, name: "Waypoint Express #18", addr: "112 Union Pl, Colombo 02", status: "done", time: "09:42 AM", items: 6 },
              { num: 3, name: "Waypoint Express #42", addr: "78 Orchard Blvd, Colombo 07", status: "active", time: "10:45 AM", items: 3 },
              { num: 4, name: "Waypoint Express #55", addr: "33 Flower Rd, Colombo 07", status: "pending", time: "11:20 AM", items: 5 },
              { num: 5, name: "Colombo Fort Depot", addr: "Fort Railway Station Rd", status: "pending", time: "12:00 PM", items: 0 },
            ].map((stop) => (
              <div
                key={stop.num}
                className="rounded-2xl p-4"
                style={{
                  backgroundColor: stop.status === "active" ? "#FFFFFF" : "#FFFFFF",
                  border: `1px solid ${stop.status === "active" ? "#2167D5" : "#D9E1E8"}`,
                  boxShadow: stop.status === "active" ? "0px 5px 16px 0px rgba(33,103,213,0.12)" : "none",
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
                    style={{
                      width: 30, height: 30,
                      backgroundColor:
                        stop.status === "done" ? "#E8F6EF" :
                        stop.status === "active" ? "#163A5F" : "#F2F5F8",
                    }}
                  >
                    {stop.status === "done"
                      ? <span style={{ color: "#18794E", fontSize: 13 }}>✓</span>
                      : <span className="text-xs font-bold" style={{ color: stop.status === "active" ? "#FFFFFF" : "#8793A0" }}>{stop.num}</span>
                    }
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-sm font-semibold"
                      style={{
                        color: stop.status === "done" ? "#8793A0" : "#12202E",
                        textDecoration: stop.status === "done" ? "line-through" : "none",
                      }}
                    >
                      {stop.name}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#8793A0" }}>{stop.addr}</p>
                    {stop.items > 0 && (
                      <p className="text-xs mt-1 font-semibold" style={{ color: "#5D6A78" }}>{stop.items} items</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold" style={{ color: stop.status === "active" ? "#2167D5" : "#8793A0" }}>
                      {stop.time}
                    </p>
                    {stop.status === "active" && (
                      <Link href="/driver/pod">
                        <button
                          className="mt-1 text-[10px] font-bold px-2 py-1 rounded-full"
                          style={{ backgroundColor: "#163A5F", color: "#FFFFFF" }}
                        >
                          POD
                        </button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
