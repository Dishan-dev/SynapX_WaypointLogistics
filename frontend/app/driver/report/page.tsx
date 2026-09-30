"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Signal, BatteryFull, Store, DoorClosed, PackageX,
  Ellipsis, Check, Map, Home, TriangleAlert, Layers
} from "lucide-react";

export default function ReportProblemPage() {
  const [selectedIssue, setSelectedIssue] = useState("Outlet closed");

  const issues = [
    { label: "Outlet closed", icon: Store },
    { label: "Access denied", icon: DoorClosed },
    { label: "Order mismatch", icon: PackageX },
    { label: "Other", icon: Ellipsis },
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
      
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
              Report a problem
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em]" style={{ color: "#5D6A78" }}>
              Trip R-1042 · Stop 2
            </p>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex flex-col flex-1 px-5 pt-[18px] pb-[100px] gap-3">
        
        {/* Delivery issues */}
        <div className="flex flex-col gap-2 w-full">
          <h2 className="font-bold text-[18px]" style={{ color: "#12202E" }}>Delivery issue</h2>
          
          <div className="flex flex-col gap-2.5 w-full">
            {issues.map((issue) => {
              const Icon = issue.icon;
              const isSelected = selectedIssue === issue.label;

              return (
                <div 
                  key={issue.label}
                  onClick={() => setSelectedIssue(issue.label)}
                  className="flex items-center justify-between p-[11px] rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? "#EAF2FF" : "#FFFFFF",
                    border: `1px solid ${isSelected ? "#2167D5" : "#D9E1E8"}`,
                    boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)"
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={19} color="#12202E" />
                    <span 
                      className={`text-[14px] ${isSelected ? 'font-bold' : 'font-medium'}`} 
                      style={{ color: "#12202E" }}
                    >
                      {issue.label}
                    </span>
                  </div>
                  
                  <div 
                    className="flex justify-center items-center w-[19px] h-[19px] rounded-full"
                    style={{ 
                      backgroundColor: isSelected ? "#2167D5" : "#FFFFFF",
                      border: `2px solid ${isSelected ? "#2167D5" : "#D9E1E8"}`
                    }}
                  >
                    {isSelected && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional note */}
        <div className="flex flex-col gap-1 w-full mt-1">
          <label className="font-semibold text-[12px]" style={{ color: "#12202E" }}>Optional note</label>
          <textarea 
            className="w-full h-[120px] p-4 rounded bg-white outline-none resize-none font-normal text-[16px]"
            style={{ border: "1px solid #E0E0E0", color: "#4F4F4F" }}
            placeholder="Add details for dispatch…"
          />
        </div>

        {/* Secondary action */}
        <button 
          className="w-full flex justify-center items-center h-[40px] rounded-md mt-1"
          style={{ border: "1px solid #E5E5E2", backgroundColor: "#FFFFFF" }}
        >
          <span className="font-semibold text-[13px]" style={{ color: "#171A1F" }}>Add photo +</span>
        </button>

        {/* Primary action */}
        <Link href="/driver" className="w-full mt-1">
          <button 
            className="w-full flex justify-center items-center h-[55px] rounded-lg text-white font-bold text-[16px]"
            style={{ backgroundColor: "#092C4C" }}
          >
            Submit report
          </button>
        </Link>
      </div>

      {/* Bottom Nav */}
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-8 py-2.5 bg-white z-50"
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
          <TriangleAlert size={22} color="#163A5F" />
          <span className="text-[10px] font-bold" style={{ color: "#163A5F" }}>Report</span>
        </Link>
        <Link href="/driver/queue" className="flex flex-col items-center gap-1 w-[72px]">
          <Layers size={22} color="#5D6A78" />
          <span className="text-[10px] font-medium" style={{ color: "#5D6A78" }}>Queue</span>
        </Link>
      </div>
    </div>
  );
}
