"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, MapPin, Package, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

const notifications = [
  {
    id: 1, type: "dispatch", icon: MapPin, color: "#2167D5", bg: "#EAF2FF",
    title: "New trip assigned", body: "TRIP-024 has been assigned to you. 5 stops, starts 08:30 AM.",
    time: "08:15 AM", read: false,
  },
  {
    id: 2, type: "delivery", icon: CheckCircle2, color: "#18794E", bg: "#E8F6EF",
    title: "Stop 2 confirmed", body: "Delivery at Waypoint Express #18 marked as complete.",
    time: "09:43 AM", read: false,
  },
  {
    id: 3, type: "alert", icon: AlertTriangle, color: "#A85D00", bg: "#FFF4D6",
    title: "Traffic delay ahead", body: "Expect 15-min delay on Union Place due to road works.",
    time: "10:02 AM", read: true,
  },
  {
    id: 4, type: "delivery", icon: Package, color: "#163A5F", bg: "#EAF2FF",
    title: "POD required", body: "Please submit proof of delivery for stop 3 before 11:00 AM.",
    time: "10:30 AM", read: true,
  },
  {
    id: 5, type: "system", icon: Bell, color: "#5D6A78", bg: "#F2F5F8",
    title: "App synced", body: "All delivery data has been synced to the server.",
    time: "Yesterday", read: true,
  },
];

export default function NotificationsPage() {
  const [items, setItems] = useState(notifications);

  const markAllRead = () => setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      {/* Status Bar */}
      <div className="flex justify-between items-center px-5" style={{ height: 34, backgroundColor: "#FFFFFF" }}>
        <span className="text-xs font-semibold" style={{ color: "#12202E" }}>06:58</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #D9E1E8" }}>
        <div className="flex items-center gap-3">
          <Link href="/driver">
            <button className="flex items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: "#F2F5F8" }}>
              <ArrowLeft size={18} color="#163A5F" />
            </button>
          </Link>
          <div>
            <span className="text-base font-bold" style={{ color: "#163A5F" }}>Notifications</span>
            {unreadCount > 0 && (
              <span
                className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#C9363E", color: "#FFFFFF" }}
              >
                {unreadCount}
              </span>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button className="text-xs font-semibold" style={{ color: "#163A5F" }} onClick={markAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-2 pb-24">
        {items.map((notif) => (
          <button
            key={notif.id}
            className="w-full text-left flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: notif.read ? "#FFFFFF" : "#FAFCFF",
              border: `1px solid ${notif.read ? "#D9E1E8" : "#DCEAF4"}`,
              boxShadow: notif.read ? "none" : "0px 3px 10px 0px rgba(22,58,95,0.07)",
            }}
            onClick={() => setItems((prev) => prev.map((n) => n.id === notif.id ? { ...n, read: true } : n))}
          >
            <div
              className="flex items-center justify-center rounded-full shrink-0 mt-0.5"
              style={{ width: 38, height: 38, backgroundColor: notif.bg }}
            >
              <notif.icon size={16} color={notif.color} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold truncate" style={{ color: "#12202E" }}>{notif.title}</p>
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "#2167D5" }} />
                )}
              </div>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#5D6A78" }}>{notif.body}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <Clock size={10} color="#8793A0" />
                <span className="text-[10px]" style={{ color: "#8793A0" }}>{notif.time}</span>
              </div>
            </div>
          </button>
        ))}

        {items.every((n) => n.read) && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="flex items-center justify-center rounded-full" style={{ width: 64, height: 64, backgroundColor: "#E8F6EF" }}>
              <CheckCircle2 size={28} color="#18794E" />
            </div>
            <p className="text-sm font-semibold" style={{ color: "#12202E" }}>All caught up!</p>
            <p className="text-xs" style={{ color: "#8793A0" }}>No unread notifications</p>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-around px-2 py-3"
        style={{ backgroundColor: "#FFFFFF", boxShadow: "0px -8px 28px 0px rgba(11,39,67,0.16)", height: 72 }}>
        {[
          { label: "Home", icon: Package, href: "/driver", active: false },
          { label: "Trip", icon: MapPin, href: "/driver/trip", active: false },
          { label: "Notify", icon: Bell, href: "/driver/notifications", active: true },
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
