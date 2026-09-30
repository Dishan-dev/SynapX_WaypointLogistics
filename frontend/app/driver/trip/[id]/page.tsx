"use client";

import React from "react";
import Link from "next/link";
import {
  ChevronLeft, Signal, BatteryFull, CalendarClock,
  ClipboardCheck, Map, Home, TriangleAlert, Layers
} from "lucide-react";

export default function TripDetailsPage() {
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
        <div className="flex px-5 py-2.5 items-center gap-3 w-full">
          <Link href="/driver">
            <ChevronLeft size={22} color="#12202E" />
          </Link>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-bold leading-[1.25em]" style={{ color: "#12202E" }}>
              Trip R-1042
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em]" style={{ color: "#5D6A78" }}>
              VEH014 · 4 stops · Ambient
            </p>
          </div>
        </div>
      </div>

      {/* Overview content */}
      <div className="flex flex-col flex-1 px-5 pt-[18px] pb-24 gap-4">
        {/* Schedule metrics */}
        <div className="flex w-full gap-2.5">
          <div 
            className="flex-1 flex flex-col p-3.5 rounded-xl gap-2.5 bg-white"
            style={{ border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)" }}
          >
            <span className="font-bold text-[22px]" style={{ color: "#163A5F" }}>03:45</span>
            <span className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>Planned depart</span>
          </div>
          <div 
            className="flex-1 flex flex-col p-3.5 rounded-xl gap-2.5 bg-white"
            style={{ border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)" }}
          >
            <span className="font-bold text-[22px]" style={{ color: "#12202E" }}>07:55</span>
            <span className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>Last window closes</span>
          </div>
        </div>

        {/* Route title */}
        <div className="flex justify-between items-center w-full">
          <span className="font-bold text-[18px]" style={{ color: "#12202E" }}>Stop sequence</span>
          <div className="flex items-center px-2 py-1 rounded-full bg-[#EAF2FF]">
            <span className="font-bold text-[10px]" style={{ color: "#2167D5" }}>4 to deliver</span>
          </div>
        </div>

        {/* Stop sequence card */}
        <div 
          className="flex flex-col p-3.5 gap-2.5 rounded-xl bg-white"
          style={{ border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)" }}
        >
          {/* Stop 1 */}
          <div className="flex w-full gap-3">
            <div className="flex justify-center items-center w-[30px] h-[30px] rounded-full shrink-0" style={{ backgroundColor: "#163A5F" }}>
              <span className="font-bold text-[12px] text-white">1</span>
            </div>
            <div className="flex flex-col w-full pb-3" style={{ borderBottom: "1px solid #D9E1E8" }}>
              <div className="flex justify-between items-baseline w-full">
                <span className="font-bold text-[14px]" style={{ color: "#12202E" }}>Green Valley Mart</span>
                <span className="font-semibold text-[12px]" style={{ color: "#163A5F" }}>06:30–07:00</span>
              </div>
            </div>
          </div>

          {/* Stop 2 */}
          <div className="flex w-full gap-3">
            <div className="flex justify-center items-center w-[30px] h-[30px] rounded-full shrink-0" style={{ backgroundColor: "#163A5F" }}>
              <span className="font-bold text-[12px] text-white">2</span>
            </div>
            <div className="flex flex-col w-full pb-3" style={{ borderBottom: "1px solid #D9E1E8" }}>
              <div className="flex justify-between items-baseline w-full">
                <span className="font-bold text-[14px]" style={{ color: "#12202E" }}>Harbor Fresh Foods</span>
                <span className="font-semibold text-[12px]" style={{ color: "#163A5F" }}>06:45–07:30</span>
              </div>
            </div>
          </div>

          {/* Stop 3 */}
          <div className="flex w-full gap-3">
            <div className="flex justify-center items-center w-[30px] h-[30px] rounded-full shrink-0" style={{ backgroundColor: "#163A5F" }}>
              <span className="font-bold text-[12px] text-white">3</span>
            </div>
            <div className="flex flex-col w-full pb-3" style={{ borderBottom: "1px solid #D9E1E8" }}>
              <div className="flex justify-between items-baseline w-full">
                <span className="font-bold text-[14px]" style={{ color: "#12202E" }}>Lakeside Grocers</span>
                <span className="font-semibold text-[12px]" style={{ color: "#163A5F" }}>07:00–07:45</span>
              </div>
            </div>
          </div>

          {/* Deferred Stop */}
          <div className="flex w-full gap-3 opacity-75">
            <div className="flex justify-center items-center w-[30px] h-[30px] rounded-full bg-[#FFF4D6] shrink-0">
              <CalendarClock size={15} color="#A85D00" />
            </div>
            <div className="flex flex-col w-full pb-3" style={{ borderBottom: "1px solid #D9E1E8" }}>
              <div className="flex justify-between items-baseline w-full">
                <span className="font-bold text-[14px]" style={{ color: "#12202E" }}>Cityview Market</span>
                <span className="font-semibold text-[12px]" style={{ color: "#A85D00" }}>Deferred</span>
              </div>
              <span className="font-normal text-[12px] leading-[1.45em] mt-0.5" style={{ color: "#5D6A78" }}>
                Removed from today’s run — fleet capacity short. Rescheduled tomorrow.
              </span>
            </div>
          </div>

          {/* Stop 4 */}
          <div className="flex w-full gap-3">
            <div className="flex justify-center items-center w-[30px] h-[30px] rounded-full shrink-0" style={{ backgroundColor: "#163A5F" }}>
              <span className="font-bold text-[12px] text-white">4</span>
            </div>
            <div className="flex flex-col w-full pb-3">
              <div className="flex justify-between items-baseline w-full">
                <span className="font-bold text-[14px]" style={{ color: "#12202E" }}>Riverside Outlet</span>
                <span className="font-semibold text-[12px]" style={{ color: "#163A5F" }}>07:20–07:55</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pre-trip check banner */}
        <div 
          className="flex p-3 gap-2.5 rounded-xl bg-[#EAF2FF]"
          style={{ border: "1px solid rgba(33, 103, 213, 0.21)" }}
        >
          <ClipboardCheck size={18} color="#2167D5" className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5 w-full">
            <span className="font-bold text-[12px] leading-[1.45em]" style={{ color: "#2167D5" }}>Pre-trip check</span>
            <span className="font-normal text-[12px] leading-[1.45em]" style={{ color: "#2167D5" }}>
              Confirm VEH014 is loaded, sealed, and ready to depart.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <Link href="/driver/trip" className="w-full">
          <button 
            className="w-full flex justify-center items-center h-[55px] rounded-lg text-white font-bold text-[16px]"
            style={{ backgroundColor: "#092C4C" }}
          >
            Start trip
          </button>
        </Link>
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
          <Home size={22} color="#8793A0" />
          <span className="text-[10px] font-medium" style={{ color: "#8793A0" }}>Home</span>
        </Link>
        <Link href="/driver/trip" className="flex flex-col items-center gap-1 w-[72px]">
          <Map size={22} color="#8793A0" />
          <span className="text-[10px] font-medium" style={{ color: "#8793A0" }}>Map</span>
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
