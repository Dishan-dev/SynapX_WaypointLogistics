"use client";

import React from "react";
import Link from "next/link";
import {
  Signal, BatteryFull, MapPinCheck, PackageCheck, CloudUpload,
  CircleCheck, Map, Home, TriangleAlert, Layers
} from "lucide-react";

export default function SyncingQueuePage() {
  const syncingRecords = [
    {
      type: "ARRIVAL",
      title: "Harbor Fresh Foods",
      status: "Synced",
      icon: MapPinCheck,
      color: "#18794E",
      bg: "#E8F6EF",
    },
    {
      type: "DELIVERY OUTCOME",
      title: "ORD0092308",
      status: "Synced",
      icon: PackageCheck,
      color: "#18794E",
      bg: "#E8F6EF",
    },
    {
      type: "POD",
      title: "ORD0092308",
      status: "Uploading",
      icon: CloudUpload,
      color: "#2167D5",
      bg: "#EAF2FF",
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
            <span className="text-[14px] font-normal" style={{ color: "#BDBDBD" }}>Syncing</span>
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
              Syncing 2 / 3
            </p>
          </div>
        </div>
      </div>

      {/* Syncing Content */}
      <div className="flex flex-col flex-1 px-5 pt-[24px] pb-[100px] gap-[18px]">
        
        {/* Progress Card */}
        <div 
          className="flex flex-col p-[18px] gap-[10px] w-full rounded-xl"
          style={{ backgroundColor: "#EAF2FF", border: "2px solid #2167D5" }}
        >
          <div className="flex justify-between items-baseline w-full">
            <div className="flex flex-col gap-[3px]">
              <span className="font-bold text-[18px]" style={{ color: "#12202E" }}>Syncing 2 / 3</span>
              <span className="font-normal text-[12px]" style={{ color: "#5D6A78" }}>Uploading proof of delivery</span>
            </div>
            <span className="font-bold text-[24px]" style={{ color: "#2167D5" }}>66%</span>
          </div>
          
          <div className="w-full h-[9px] rounded-full" style={{ backgroundColor: "#D5E3F8" }}>
            <div className="h-[9px] rounded-full" style={{ width: "66%", backgroundColor: "#2167D5" }}></div>
          </div>
          
          <span className="font-normal text-[12px] leading-[1.45em]" style={{ color: "#2167D5" }}>
            Connection restored · Uploading securely
          </span>
        </div>

        {/* Records */}
        <div className="flex flex-col gap-[9px] w-full">
          {syncingRecords.map((record, index) => {
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
                    style={{ backgroundColor: record.bg }}
                  >
                    <Icon size={19} color={record.color === "#18794E" ? "#12202E" : record.color} />
                  </div>
                  <div className="flex flex-col gap-0.5 w-full">
                    <span className="font-bold text-[10px]" style={{ color: record.color }}>{record.type}</span>
                    <span className="font-bold text-[14px]" style={{ color: "#12202E" }}>{record.title}</span>
                  </div>
                  <div className="flex items-center px-[9px] py-[5px] rounded-full shrink-0" style={{ backgroundColor: record.bg }}>
                    <span className="font-medium text-[10px]" style={{ color: record.color }}>{record.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Banner */}
        <div 
          className="flex p-3 gap-2.5 rounded-xl w-full"
          style={{ backgroundColor: "#E8F6EF", border: "1px solid rgba(24, 121, 78, 0.21)" }}
        >
          <CircleCheck size={18} color="#18794E" className="shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-[12px] leading-[1.45em]" style={{ color: "#18794E" }}>
              Almost done — you can keep driving.
            </span>
            <span className="font-normal text-[12px] leading-[1.45em]" style={{ color: "#18794E" }}>
              Sync continues safely in the background.
            </span>
          </div>
        </div>

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
