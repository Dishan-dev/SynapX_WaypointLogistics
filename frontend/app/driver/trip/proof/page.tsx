"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Signal, BatteryFull, CloudOff, Camera,
  Map, Home, TriangleAlert, Layers
} from "lucide-react";

export default function ProofOfDeliveryPage() {
  const [recipientName, setRecipientName] = useState("Malini Perera");

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
            <span className="text-[14px] font-normal" style={{ color: "#BDBDBD" }}>Saving offline</span>
            <Signal size={16} color="#BDBDBD" />
            <BatteryFull size={18} color="#BDBDBD" />
          </div>
        </div>

        {/* Title bar */}
        <div className="flex px-5 py-2.5 items-center w-full">
          <div className="flex flex-col gap-0.5">
            <h1 className="text-[18px] font-bold leading-[1.25em]" style={{ color: "#12202E" }}>
              Proof of Delivery
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em]" style={{ color: "#5D6A78" }}>
              Order ORD0092308
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
          <span className="font-semibold text-[13px]" style={{ color: "#18385F" }}>Saved locally</span>
          <span className="font-normal text-[12px] mt-1" style={{ color: "#6B7280" }}>
            Your proof is safe on this device.
          </span>
        </div>
      </div>

      {/* Proof Map */}
      <div className="relative w-full overflow-hidden shrink-0 z-0" style={{ height: "96px", backgroundColor: "#F2F5F8" }}>
        {/* Map placeholder */}
        <div className="absolute inset-0">
          <div className="absolute left-[38px] top-[-30px] w-[22.56px] h-[156px] bg-white" />
          <div className="absolute left-[118px] top-[-30px] w-[22.56px] h-[156px] bg-white" />
          <div className="absolute left-[198px] top-[-30px] w-[22.56px] h-[156px] bg-white" />
          <div className="absolute left-[278px] top-[-30px] w-[22.56px] h-[156px] bg-white" />
          <div className="absolute left-[348px] top-[-30px] w-[22.56px] h-[156px] bg-white" />
          
          <div className="absolute left-0 top-[26px] w-full h-[10px] bg-white" />
          <div className="absolute left-0 top-[92px] w-full h-[10px] bg-white" />
          <div className="absolute left-0 top-[103px] w-full h-[64px] bg-white" />
          
          <div className="absolute left-[260px] top-0 w-[130px] h-full" style={{ backgroundColor: "#DCEAF4" }} />
          
          <svg className="absolute left-[22px] top-[30px] w-[320px] h-[230px]" style={{ pointerEvents: "none" }}>
            <path d="M21,188 L152,98 L248,46 L306,12" stroke="#2167D5" strokeWidth="5" strokeDasharray="10,7" fill="none" />
          </svg>

          {/* Map Dimmer */}
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(11, 39, 67, 0.6)" }} />

          {/* Current location & Pins */}
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
        className="flex flex-col flex-1 bg-white rounded-t-[24px] px-5 pb-5 pt-2.5 gap-[14px] z-20 relative overflow-y-auto"
        style={{ boxShadow: "0px -8px 28px 0px rgba(11, 39, 67, 0.16)", marginTop: "-20px" }}
      >
        {/* Drag Handle */}
        <div className="w-full flex justify-center pb-2 shrink-0">
          <div className="w-[40px] h-[4px] rounded-full" style={{ backgroundColor: "#D9E1E8" }} />
        </div>

        {/* Order summary */}
        <div className="flex justify-between items-center w-full shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-[10px]" style={{ color: "#2167D5" }}>FULL DELIVERY</span>
            <span className="font-bold text-[18px]" style={{ color: "#12202E" }}>ORD0092308</span>
          </div>
          <CloudOff size={22} color="#8793A0" />
        </div>

        {/* Form field (Recipient name) */}
        <div className="flex flex-col gap-1.5 w-full shrink-0">
          <label className="font-semibold text-[12px]" style={{ color: "#12202E" }}>Recipient name</label>
          <div className="flex items-center w-full px-[14px] h-[40px] rounded-md" style={{ border: "1px solid #E5E5E2" }}>
            <input 
              type="text" 
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full text-[13px] outline-none"
              style={{ color: "#6B7280", backgroundColor: "transparent" }}
            />
          </div>
        </div>

        {/* Signature field */}
        <div className="flex flex-col gap-1.5 w-full shrink-0">
          <label className="font-semibold text-[12px]" style={{ color: "#12202E" }}>Recipient signature</label>
          <div className="relative w-full rounded-lg bg-white overflow-hidden" style={{ height: "108px", border: "1px solid #D9E1E8" }}>
            {/* Baseline */}
            <div className="absolute left-[18px] right-[18px] bottom-[26px] h-[1px]" style={{ backgroundColor: "#D9E1E8" }} />
            
            {/* Signature content */}
            <div className="absolute left-[62px] top-[24px]">
              <span className="italic font-medium text-[30px]" style={{ color: "#163A5F" }}>Malini P.</span>
            </div>

            {/* Timestamp */}
            <div className="absolute left-[18px] bottom-[8px]">
              <span className="font-normal text-[10px]" style={{ color: "#8793A0" }}>Signed at 06:59</span>
            </div>
          </div>
        </div>

        {/* Photo evidence */}
        <div 
          className="flex flex-col justify-center items-center w-full p-[14px] gap-2 rounded-xl shrink-0 cursor-pointer"
          style={{ height: "126px", backgroundColor: "#F2F5F8", border: "1px dashed #2167D5" }}
        >
          <Camera size={25} color="#12202E" />
          <span className="font-bold text-[14px]" style={{ color: "#12202E" }}>Add photo evidence</span>
          <span className="font-normal text-[12px] text-center" style={{ color: "#5D6A78" }}>
            Capture delivered goods at the rear dock.
          </span>
        </div>

        {/* Primary Action Button */}
        <div className="mt-auto pt-2 shrink-0">
          <Link href="/driver">
            <button 
              className="w-full flex justify-center items-center h-[55px] rounded-lg text-white font-bold text-[16px]"
              style={{ backgroundColor: "#092C4C" }}
            >
              Submit & complete stop
            </button>
          </Link>
        </div>
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
          <Map size={22} color="#8793A0" />
          <span className="text-[10px] font-medium" style={{ color: "#8793A0" }}>Map</span>
        </Link>
        <Link href="/driver/sos" className="flex flex-col items-center gap-1 w-[72px]">
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
