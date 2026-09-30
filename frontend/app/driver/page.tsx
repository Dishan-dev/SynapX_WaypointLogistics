"use client";

import React from "react";
import Link from "next/link";
import {
  MapPin, Signal, BatteryFull, Map, Home, TriangleAlert, Layers
} from "lucide-react";

export default function DriverDashboard() {
  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      {/* Header */}
      <div 
        className="flex flex-col w-full bg-white"
        style={{ borderBottom: "1px solid #D9E1E8" }}
      >
        {/* Device status */}
        <div className="flex justify-between items-center px-5 h-[34px] w-full">
          <span className="text-xs font-semibold" style={{ color: "#12202E" }}>06:58</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-normal text-[#BDBDBD]">Synced</span>
            <Signal size={16} color="#BDBDBD" />
            <BatteryFull size={18} color="#BDBDBD" />
          </div>
        </div>

        {/* Title bar */}
        <div className="flex px-5 py-2.5 items-center w-full">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-bold leading-[1.25em]" style={{ color: "#12202E" }}>
              Today — Tue, Sep 29
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em]" style={{ color: "#5D6A78" }}>
              Good morning, Nimal · VEH014
            </p>
          </div>
        </div>
      </div>

      {/* Trips content */}
      <div className="flex flex-col flex-1 px-5 pt-5 pb-24 gap-4">
        {/* Active Trip Card */}
        <div 
          className="flex flex-col p-4 gap-2.5 rounded-xl"
          style={{ backgroundColor: "#EAF2FF", border: "2px solid #2167D5" }}
        >
          {/* Trip Header */}
          <div className="flex justify-between items-start w-full">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-[24px]" style={{ color: "#0B2743" }}>Trip R-1042</span>
              <span className="font-semibold text-[12px]" style={{ color: "#5D6A78" }}>VEH014 · 4 stops to deliver</span>
            </div>
            <div className="flex items-center px-2 py-1 rounded-full bg-[#FFF4D6]">
              <span className="font-bold text-[10px]" style={{ color: "#A85D00" }}>Not started</span>
            </div>
          </div>

          {/* Trip tags */}
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center px-2.5 py-1.5 rounded-full bg-[#E8F6EF]">
              <span className="font-bold text-[10px]" style={{ color: "#18794E" }}>Ambient</span>
            </div>
            <div className="flex items-center px-2.5 py-1.5 rounded-full bg-[#FFF4D6]">
              <span className="font-bold text-[10px]" style={{ color: "#A85D00" }}>Depart by 03:45</span>
            </div>
          </div>

          {/* Region */}
          <div className="flex items-center gap-2 mt-1">
            <MapPin size={17} color="#12202E" />
            <span className="font-semibold text-[14px]" style={{ color: "#12202E" }}>Colombo & Gampaha</span>
          </div>

          {/* Action */}
          <Link href="/driver/trip/TRIP-1042" className="mt-2">
            <button 
              className="w-full flex justify-center items-center h-[55px] rounded-lg text-white font-bold text-[16px]"
              style={{ backgroundColor: "#092C4C" }}
            >
              Open Trip R-1042
            </button>
          </Link>
        </div>

        {/* Scheduled Trip Card */}
        <div 
          className="flex flex-col p-4 gap-2.5 rounded-xl bg-white"
          style={{ border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)" }}
        >
          {/* Trip Header */}
          <div className="flex justify-between items-start w-full mb-1">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-[18px]" style={{ color: "#12202E" }}>Trip R-1043</span>
              <span className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>Scheduled · 13:00</span>
            </div>
            <div className="flex items-center px-2 py-1 rounded-full bg-[#E9EEF3]">
              <span className="font-bold text-[10px]" style={{ color: "#5D6A78" }}>Later today</span>
            </div>
          </div>

          <div className="flex justify-between items-baseline w-full">
            <span className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>Stops</span>
            <span className="font-bold text-[12px]" style={{ color: "#5D6A78" }}>3 stops</span>
          </div>
          
          <div className="flex justify-between items-baseline w-full mt-[-2px]">
            <span className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>Load type</span>
            <span className="font-bold text-[12px]" style={{ color: "#5D6A78" }}>Style</span>
          </div>
        </div>

        {/* Shift Summary */}
        <div className="flex w-full gap-2.5 mt-2">
          <div className="flex-1 flex flex-col p-3.5 rounded-xl gap-1" style={{ backgroundColor: "#0B2743" }}>
            <span className="font-bold text-[22px] text-white">7</span>
            <span className="font-normal text-[12px]" style={{ color: "rgba(255, 255, 255, 0.72)" }}>Stops today</span>
          </div>
          <div className="flex-1 flex flex-col p-3.5 rounded-xl gap-1 bg-white" style={{ border: "1px solid #D9E1E8" }}>
            <span className="font-bold text-[22px]" style={{ color: "#12202E" }}>2</span>
            <span className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>Trips assigned</span>
          </div>
        </div>
      </div>

      {/* SOS Button */}
      <Link href="/driver/sos">
        <button 
          className="fixed bottom-[96px] right-5 flex justify-center items-center w-[54px] h-[54px] rounded-full text-white font-extrabold text-[12px]"
          style={{ backgroundColor: "#C9363E", boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)" }}
        >
          SOS
        </button>
      </Link>

      {/* Bottom Nav */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-8 py-2.5 bg-white"
        style={{ borderTop: "1px solid #D9E1E8", boxShadow: "0px -8px 28px 0px rgba(11, 39, 67, 0.16)" }}
      >
        <Link href="/driver" className="flex flex-col items-center gap-1 w-[72px]">
          <Home size={22} color="#111111" />
          <span className="text-[10px] font-medium" style={{ color: "#111111" }}>Home</span>
        </Link>
        <Link href="/driver/trip" className="flex flex-col items-center gap-1 w-[72px]">
          <Map size={22} color="#8793A0" />
          <span className="text-[10px] font-medium" style={{ color: "#8793A0" }}>Map</span>
        </Link>
        <Link href="/driver/report" className="flex flex-col items-center gap-1 w-[72px]">
          <TriangleAlert size={22} color="#5D6A78" />
          <span className="text-[10px] font-medium" style={{ color: "#5D6A78" }}>Report</span>
        </Link>
        <Link href="/driver/notifications" className="flex flex-col items-center gap-1 w-[72px]">
          <Layers size={22} color="#5D6A78" />
          <span className="text-[10px] font-medium" style={{ color: "#5D6A78" }}>Queue</span>
        </Link>
      </div>
    </div>
  );
}
