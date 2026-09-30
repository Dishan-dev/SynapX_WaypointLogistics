"use client";

import React from "react";
import Link from "next/link";
import {
  Signal, BatteryFull, MapPinCheck, LocateFixed,
  Map, Home, TriangleAlert, Layers
} from "lucide-react";

export default function ArrivalPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      
      {/* Header */}
      <div 
        className="flex flex-col w-full bg-white z-10"
        style={{ borderBottom: "1px solid #D9E1E8" }}
      >
        {/* Device status */}
        <div className="flex justify-between items-center px-5 h-[34px] w-full">
          <span className="text-[12px] font-semibold" style={{ color: "#12202E" }}>06:58</span>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-normal" style={{ color: "#BDBDBD" }}>Online</span>
            <Signal size={16} color="#BDBDBD" />
            <BatteryFull size={18} color="#BDBDBD" />
          </div>
        </div>

        {/* Title bar */}
        <div className="flex px-5 py-2.5 items-center w-full">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-bold leading-[1.25em]" style={{ color: "#12202E" }}>
              Harbor Fresh Foods
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em]" style={{ color: "#5D6A78" }}>
              OUT041 · Rear dock
            </p>
          </div>
        </div>
      </div>

      {/* Toast Area */}
      <div className="w-full px-[15px] py-[10px] z-10" style={{ backgroundColor: "#F2F5F8" }}>
        <div 
          className="flex flex-col p-4 w-full bg-white rounded-lg"
          style={{ border: "1px solid #E5E5E2", height: "76px" }}
        >
          <span className="font-semibold text-[13px]" style={{ color: "#18385F" }}>Arrival detected</span>
          <span className="font-normal text-[12px] mt-1" style={{ color: "#6B7280" }}>
            Timestamp and location captured automatically.
          </span>
        </div>
      </div>

      {/* Arrival Map */}
      <div className="relative w-full overflow-hidden shrink-0 z-0" style={{ height: "142px", backgroundColor: "#F2F5F8" }}>
        {/* Map placeholder */}
        <div className="absolute inset-0">
          <div className="absolute left-[38px] top-[-30px] w-[26.57px] h-[202px] bg-white" />
          <div className="absolute left-[118px] top-[-30px] w-[26.57px] h-[202px] bg-white" />
          <div className="absolute left-[198px] top-[-30px] w-[26.57px] h-[202px] bg-white" />
          <div className="absolute left-[278px] top-[-30px] w-[26.57px] h-[202px] bg-white" />
          <div className="absolute left-[348px] top-[-30px] w-[26.57px] h-[202px] bg-white" />
          
          <div className="absolute left-0 top-[26px] w-full h-[10px] bg-white" />
          <div className="absolute left-0 top-[92px] w-full h-[10px] bg-white" />
          <div className="absolute left-0 top-[103px] w-full h-[64px] bg-white" />
          
          <div className="absolute left-[260px] top-0 w-[130px] h-full" style={{ backgroundColor: "#DCEAF4" }} />
          
          <svg className="absolute left-[22px] top-[30px] w-[320px] h-[230px]" style={{ pointerEvents: "none" }}>
            <path d="M21,188 L152,98 L248,46 L306,12" stroke="#2167D5" strokeWidth="5" strokeDasharray="10,7" fill="none" />
          </svg>

          {/* Map Dimmer */}
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(11, 39, 67, 0.6)" }} />

          {/* Current location & Pins (scaled/positioned for small map) */}
          <div className="absolute left-[111px] top-[182px] w-[18px] h-[18px] rounded-full border-4 border-white z-10" style={{ backgroundColor: "#2167D5" }} />
          <div className="absolute left-[43px] top-[218px] w-[30px] h-[30px] flex justify-center items-center rounded-full border-[3px] border-white shadow-sm z-10" style={{ backgroundColor: "#18794E" }}>
            <span className="text-[12px] font-bold text-white">✓</span>
          </div>
          <div className="absolute left-[174px] top-[128px] w-[30px] h-[30px] flex justify-center items-center rounded-full border-[3px] border-white shadow-sm z-10" style={{ backgroundColor: "#163A5F" }}>
            <span className="text-[12px] font-bold text-white">2</span>
          </div>
          <div className="absolute left-[270px] top-[76px] w-[30px] h-[30px] flex justify-center items-center rounded-full border-[3px] border-[#163A5F] shadow-sm bg-white z-10">
            <span className="text-[12px] font-bold" style={{ color: "#163A5F" }}>3</span>
          </div>
          <div className="absolute left-[328px] top-[42px] w-[30px] h-[30px] flex justify-center items-center rounded-full border-[3px] border-[#163A5F] shadow-sm bg-white z-10">
            <span className="text-[12px] font-bold" style={{ color: "#163A5F" }}>4</span>
          </div>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div 
        className="flex flex-col flex-1 bg-white px-5 pb-5 pt-2.5 gap-[14px] z-20 relative"
        style={{ boxShadow: "0px -8px 28px 0px rgba(11, 39, 67, 0.16)", marginTop: "-20px" }}
      >
        {/* Drag Handle */}
        <div className="w-full flex justify-center pb-2">
          <div className="w-[40px] h-[4px] rounded-full" style={{ backgroundColor: "#D9E1E8" }} />
        </div>

        {/* Arrival Heading */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex justify-center items-center w-[44px] h-[44px] rounded-full shrink-0" style={{ backgroundColor: "#E8F6EF" }}>
            <MapPinCheck size={22} color="#18794E" />
          </div>
          <div className="flex flex-col gap-0.5 w-full">
            <h2 className="font-bold text-[24px]" style={{ color: "#12202E" }}>You’ve arrived</h2>
            <p className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>Harbor Fresh Foods · Rear dock</p>
          </div>
        </div>

        {/* Arrival Times */}
        <div className="flex w-full gap-2.5">
          <div className="flex-1 flex flex-col p-3.5 rounded-xl gap-1" style={{ backgroundColor: "#F2F5F8" }}>
            <span className="font-bold text-[10px]" style={{ color: "#5D6A78" }}>EXPECTED</span>
            <span className="font-bold text-[22px]" style={{ color: "#12202E" }}>06:45</span>
          </div>
          <div className="flex-1 flex flex-col p-3.5 rounded-xl gap-1" style={{ backgroundColor: "#E8F6EF" }}>
            <span className="font-bold text-[10px]" style={{ color: "#18794E" }}>ACTUAL · NOW</span>
            <span className="font-bold text-[22px]" style={{ color: "#18794E" }}>06:58</span>
          </div>
        </div>

        {/* Capture Confirmation */}
        <div className="flex items-center p-3 gap-2.5 rounded-xl" style={{ backgroundColor: "#EAF2FF" }}>
          <LocateFixed size={18} color="#2167D5" className="shrink-0" />
          <span className="font-normal text-[12px] leading-[1.45em]" style={{ color: "#2167D5" }}>
            Geofence captured the timestamp and location automatically.
          </span>
        </div>

        {/* Primary Action Button */}
        <Link href="/driver/trip/outcome" className="mt-auto pt-2">
          <button 
            className="w-full flex justify-center items-center h-[55px] rounded-lg text-white font-bold text-[16px]"
            style={{ backgroundColor: "#092C4C" }}
          >
            Continue
          </button>
        </Link>
      </div>

      {/* Bottom Nav */}
      <div
        className="flex items-center justify-between px-8 py-2.5 bg-white z-50 shrink-0"
        style={{ borderTop: "1px solid #D9E1E8" }}
      >
        <Link href="/driver" className="flex flex-col items-center gap-1 w-[72px]">
          <Home size={22} color="#8793A0" />
          <span className="text-[10px] font-medium" style={{ color: "#8793A0" }}>Home</span>
        </Link>
        <Link href="/driver/trip" className="flex flex-col items-center gap-1 w-[72px]">
          <Map size={22} color="#163A5F" />
          <span className="text-[10px] font-medium" style={{ color: "#163A5F" }}>Map</span>
        </Link>
        <Link href="/driver/report" className="flex flex-col items-center gap-1 w-[72px]">
          <TriangleAlert size={22} color="#5D6A78" />
          <span className="text-[10px] font-medium" style={{ color: "#5D6A78" }}>Report</span>
        </Link>
        <Link href="/driver/queue" className="flex flex-col items-center gap-1 w-[72px]">
          <Layers size={22} color="#5D6A78" />
          <span className="text-[10px] font-medium" style={{ color: "#5D6A78" }}>Queue</span>
        </Link>
      </div>
    </div>
  );
}
