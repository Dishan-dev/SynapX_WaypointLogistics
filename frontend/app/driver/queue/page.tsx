"use client";

import React from "react";
import Link from "next/link";
import {
  Signal, BatteryFull, WifiOff, MapPin, PackageCheck,
  PenTool, ShieldCheck, Map, Home, TriangleAlert, Layers
} from "lucide-react";

export default function SyncQueuePage() {
  const pendingRecords = [
    {
      type: "ARRIVAL",
      title: "Harbor Fresh Foods",
      subtitle: "06:58 · Saved on device",
      icon: MapPin,
    },
    {
      type: "DELIVERY OUTCOME",
      title: "ORD0092308",
      subtitle: "06:59 · Saved on device",
      icon: PackageCheck,
    },
    {
      type: "POD",
      title: "ORD0092308",
      subtitle: "07:01 · Saved on device",
      icon: PenTool, // using PenTool as a proxy for 'signature'
    }
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
            <span className="text-[14px] font-normal" style={{ color: "#BDBDBD" }}>Offline</span>
            <Signal size={16} color="#BDBDBD" />
            <BatteryFull size={18} color="#BDBDBD" />
          </div>
        </div>

        {/* Title bar */}
        <div className="flex px-5 py-2.5 items-center w-full">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-bold leading-[1.25em]" style={{ color: "#12202E" }}>
              Sync Queue
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em]" style={{ color: "#5D6A78" }}>
              3 pending records
            </p>
          </div>
        </div>
      </div>

      {/* Queue Content */}
      <div className="flex flex-col flex-1 px-5 pt-[18px] pb-[100px] gap-[15px]">
        
        {/* Offline Banner */}
        <div 
          className="flex p-3 gap-2.5 rounded-xl w-full"
          style={{ backgroundColor: "#FFF4D6", border: "1px solid rgba(168, 93, 0, 0.21)" }}
        >
          <WifiOff size={18} color="#A85D00" className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-[12px] leading-[1.45em]" style={{ color: "#A85D00" }}>
              No connection since 06:52
            </span>
            <span className="font-normal text-[12px] leading-[1.45em]" style={{ color: "#A85D00" }}>
              Everything below is saved on this device.
            </span>
          </div>
        </div>

        {/* Queue heading */}
        <div className="flex justify-between items-center w-full">
          <span className="font-bold text-[18px]" style={{ color: "#12202E" }}>Pending records</span>
          <div className="flex items-center px-[9px] py-[5px] rounded-full" style={{ backgroundColor: "#FFF4D6" }}>
            <span className="font-bold text-[10px]" style={{ color: "#A85D00" }}>3 pending</span>
          </div>
        </div>

        {/* Records */}
        <div className="flex flex-col gap-[9px] w-full">
          {pendingRecords.map((record, index) => {
            const Icon = record.icon;
            
            return (
              <div 
                key={index}
                className="flex flex-col p-[13px] gap-[10px] w-full bg-white rounded-xl"
                style={{ border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)" }}
              >
                <div className="flex items-center gap-[11px] w-full">
                  <div 
                    className="flex justify-center items-center w-[38px] h-[38px] rounded-lg shrink-0"
                    style={{ backgroundColor: "#FFF4D6" }}
                  >
                    <Icon size={19} color="#12202E" />
                  </div>
                  <div className="flex flex-col gap-0.5 w-full">
                    <span className="font-bold text-[10px]" style={{ color: "#A85D00" }}>{record.type}</span>
                    <span className="font-bold text-[14px]" style={{ color: "#12202E" }}>{record.title}</span>
                    <span className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>{record.subtitle}</span>
                  </div>
                  <div className="flex items-center px-[9px] py-[5px] rounded-full shrink-0" style={{ backgroundColor: "#FFF4D6" }}>
                    <span className="font-medium text-[10px]" style={{ color: "#A85D00" }}>Pending</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Queue explanation */}
        <div className="flex items-center p-3 gap-[9px] w-full bg-white rounded-xl mt-1">
          <ShieldCheck size={18} color="#BDBDBD" className="shrink-0" />
          <span className="font-normal text-[12px] leading-[1.45em]" style={{ color: "#5D6A78" }}>
            You can keep driving. Waypoint will retry automatically in the background.
          </span>
        </div>

        {/* Primary action */}
        <Link href="/driver/queue/sync" className="w-full mt-1">
          <button 
            className="w-full flex justify-center items-center h-[55px] rounded-lg text-white font-bold text-[16px]"
            style={{ backgroundColor: "#092C4C" }}
          >
            Retry sync
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
          <TriangleAlert size={22} color="#8793A0" />
          <span className="text-[10px] font-medium" style={{ color: "#8793A0" }}>Report</span>
        </Link>
        <Link href="/driver/queue" className="flex flex-col items-center gap-1 w-[72px]">
          <Layers size={22} color="#163A5F" />
          <span className="text-[10px] font-bold" style={{ color: "#163A5F" }}>Queue</span>
        </Link>
      </div>
    </div>
  );
}
