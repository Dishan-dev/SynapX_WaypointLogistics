"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Signal, BatteryFull, Crosshair, CornerUpRight,
  Map as MapIcon, Home, TriangleAlert, Layers
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface DeliveryStop {
  id: number;
  sequence: number;
  address: string;
  customer_name: string;
  status: string;
}

interface TripDetail {
  id: number;
  dispatch_trip_id: number;
  status: string;
  stops: DeliveryStop[];
}

export default function RouteMapPage() {
  const router = useRouter();
  const [activeTrip, setActiveTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    async function loadActiveTrip() {
      try {
        const trips = await apiFetch<any[]>("/driver/trips/today");
        const startedTrip = trips.find(t => t.status === "STARTED");
        
        if (startedTrip) {
          const tripDetail = await apiFetch<TripDetail>(`/driver/trips/${startedTrip.id}`);
          setActiveTrip(tripDetail);
        } else {
          // No active trip, maybe go back to home?
          // We'll just leave activeTrip null to show a placeholder
        }
      } catch (error) {
        console.error("Failed to load active trip:", error);
      } finally {
        setLoading(false);
      }
    }
    loadActiveTrip();
  }, []);

  const pendingStops = activeTrip?.stops?.filter(s => s.status === 'PENDING') || [];
  const currentStop = pendingStops[0]; // Next stop to deliver
  const completedCount = activeTrip?.stops?.filter(s => s.status === 'COMPLETED').length || 0;
  const totalCount = activeTrip?.stops?.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col font-sans relative" style={{ backgroundColor: "#F2F5F8", fontFamily: "Inter, sans-serif" }}>
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
              {loading ? "Loading Route..." : currentStop ? `Route · Stop ${currentStop.sequence} of ${totalCount}` : "Route · No Active Stops"}
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em]" style={{ color: "#5D6A78" }}>
              {loading ? "..." : `${completedCount} of ${totalCount} complete · ${progressPercent}%`}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Map Area */}
      <div className="relative w-full overflow-hidden" style={{ height: "314px", backgroundColor: "#F2F5F8" }}>
        {/* Map Placeholder Graphics */}
        <div className="absolute inset-0 opacity-80">
          <div className="absolute left-[38px] top-[-30px] w-[42px] h-[373px] bg-white" />
          <div className="absolute left-[118px] top-[-30px] w-[42px] h-[373px] bg-white" />
          <div className="absolute left-[198px] top-[-30px] w-[42px] h-[373px] bg-white" />
          <div className="absolute left-[278px] top-[-30px] w-[42px] h-[373px] bg-white" />
          <div className="absolute left-[348px] top-[-30px] w-[42px] h-[373px] bg-white" />
          
          <div className="absolute left-0 top-[26px] w-full h-[10px] bg-white" />
          <div className="absolute left-0 top-[92px] w-full h-[10px] bg-white" />
          <div className="absolute left-0 top-[103px] w-full h-[64px] bg-white" />
          <div className="absolute left-0 top-[224px] w-full h-[10px] bg-white" />
          <div className="absolute left-0 top-[290px] w-full h-[10px] bg-white" />
          
          <div className="absolute left-[260px] top-0 w-[130px] h-full" style={{ backgroundColor: "#DCEAF4" }} />
          
          {/* Route path simulation */}
          <svg className="absolute left-[22px] top-[30px] w-[320px] h-[230px]" style={{ pointerEvents: "none" }}>
            <path d="M21,188 L152,98 L248,46 L306,12" stroke="#2167D5" strokeWidth="5" strokeDasharray="10,7" fill="none" />
          </svg>

          {/* Current location & Pins */}
          <div className="absolute left-[111px] top-[182px] w-[18px] h-[18px] rounded-full border-4 border-white" style={{ backgroundColor: "#2167D5" }} />
          
          {completedCount > 0 && (
            <div className="absolute left-[43px] top-[218px] w-[30px] h-[30px] flex justify-center items-center rounded-full border-[3px] border-white shadow-sm" style={{ backgroundColor: "#18794E" }}>
              <span className="text-[12px] font-bold text-white">✓</span>
            </div>
          )}
          
          <div className="absolute left-[174px] top-[128px] w-[30px] h-[30px] flex justify-center items-center rounded-full border-[3px] border-white shadow-sm" style={{ backgroundColor: "#163A5F" }}>
            <span className="text-[12px] font-bold text-white">{currentStop?.sequence || 1}</span>
          </div>
        </div>

        {/* Map Controls */}
        <div className="absolute top-[14px] left-[20px] right-[20px] flex justify-between items-center z-10 pointer-events-none">
          <div className="flex items-center px-2 py-1 rounded-full pointer-events-auto" style={{ backgroundColor: "#EAF2FF" }}>
            <span className="text-[10px] font-bold" style={{ color: "#2167D5" }}>Routing to next stop</span>
          </div>
          <div className="p-2 rounded-full bg-white shadow-md pointer-events-auto cursor-pointer text-[#12202E]">
            <Crosshair size={18} />
          </div>
        </div>

        {/* Floating Turn Instruction */}
        {currentStop && (
          <div className="absolute top-[232px] left-[20px] w-[350px] flex items-center p-3 gap-2.5 rounded-xl pointer-events-none z-10 shadow-lg" style={{ backgroundColor: "#0B2743" }}>
            <CornerUpRight size={24} color="#FFFFFF" />
            <span className="text-[14px] font-bold text-white truncate">Heading to: {currentStop.customer_name}</span>
          </div>
        )}
      </div>

      {/* Route details */}
      <div className="flex flex-col flex-1 px-5 pt-3.5 pb-[100px] gap-3 relative z-20">
        
        {/* Main Destination Card */}
        {currentStop ? (
          <div 
            className="flex flex-col p-3.5 gap-2.5 rounded-xl bg-white"
            style={{ border: "1px solid #D9E1E8", boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)" }}
          >
            {/* Destination Header */}
            <div className="flex justify-between items-start w-full">
              <div className="flex flex-col gap-0.5 max-w-[200px]">
                <span className="font-bold text-[18px] leading-tight" style={{ color: "#12202E" }}>
                  {currentStop.customer_name}
                </span>
                <span className="font-normal text-[12px] mt-0.5 truncate" style={{ color: "#5D6A78" }}>
                  {currentStop.address}
                </span>
              </div>
              <div className="flex items-center px-2 py-1 rounded-full bg-[#FFF4D6]">
                <span className="font-bold text-[10px]" style={{ color: "#A85D00" }}>Expected soon</span>
              </div>
            </div>

            {/* Navigation metrics */}
            <div className="flex w-full gap-1.5 mt-1">
              <div className="flex-1 flex flex-col items-center py-2.5 rounded-lg" style={{ backgroundColor: "#F2F5F8" }}>
                <span className="font-bold text-[18px]" style={{ color: "#163A5F" }}>-- km</span>
                <span className="font-normal text-[10px]" style={{ color: "#5D6A78" }}>remaining</span>
              </div>
              <div className="flex-1 flex flex-col items-center py-2.5 rounded-lg" style={{ backgroundColor: "#F2F5F8" }}>
                <span className="font-bold text-[18px]" style={{ color: "#163A5F" }}>-- min</span>
                <span className="font-normal text-[10px]" style={{ color: "#5D6A78" }}>duration</span>
              </div>
              <div className="flex-1 flex flex-col items-center py-2.5 rounded-lg" style={{ backgroundColor: "#F2F5F8" }}>
                <span className="font-bold text-[18px]" style={{ color: "#163A5F" }}>--:--</span>
                <span className="font-normal text-[10px]" style={{ color: "#5D6A78" }}>ETA</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex w-full gap-2 mt-1">
              <button 
                className="flex-1 flex justify-center items-center h-[55px] rounded-lg bg-white"
                style={{ border: "1px solid #E5E5E2" }}
              >
                <span className="font-semibold text-[13px]" style={{ color: "#171A1F" }}>Stop details</span>
              </button>
              <Link href={`/driver/trip/arrived?stop_id=${currentStop.id}`} className="flex-[1.3] w-full">
                <button 
                  className="w-full h-[55px] flex justify-center items-center rounded-lg text-white"
                  style={{ backgroundColor: "#092C4C" }}
                >
                  <span className="font-bold text-[16px]">I’m here now</span>
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col p-4 rounded-xl bg-white text-center shadow-sm" style={{ border: "1px solid #D9E1E8" }}>
            <span className="font-bold text-[#12202E]">No Active Stops</span>
            {activeTrip ? (
              <span className="text-sm text-[#5D6A78] mt-1">You have completed all stops for this trip.</span>
            ) : (
              <span className="text-sm text-[#5D6A78] mt-1">You don't have an active trip started yet.</span>
            )}
            
            {activeTrip && (
              <button 
                onClick={async () => {
                  setCompleting(true);
                  try {
                    await apiFetch(`/driver/trips/${activeTrip.id}/complete`, { method: "POST" });
                    router.push("/driver/trip/summary");
                  } catch (e) {
                    console.error("Failed to complete trip", e);
                    setCompleting(false);
                  }
                }}
                disabled={completing}
                className="mt-4 w-full h-[45px] rounded-lg text-white font-bold disabled:opacity-50" 
                style={{ backgroundColor: "#18794E" }}
              >
                {completing ? "Completing..." : "Complete Trip"}
              </button>
            )}
          </div>
        )}

        {/* Upcoming stops */}
        {pendingStops.length > 1 && (
          <div className="flex w-full gap-2.5 overflow-x-auto pb-2">
            {pendingStops.slice(1).map(stop => (
              <div 
                key={stop.id}
                className="flex-1 min-w-[140px] flex flex-col p-3 rounded-xl gap-1 bg-white shrink-0"
                style={{ border: "1px solid #D9E1E8" }}
              >
                <span className="font-bold text-[10px]" style={{ color: "#5D6A78" }}>STOP {stop.sequence}</span>
                <span className="font-bold text-[12px] leading-[1.45em] truncate" style={{ color: "#12202E" }}>{stop.customer_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SOS Button */}
      <Link href="/driver/sos">
        <button 
          className="fixed bottom-[86px] right-5 flex justify-center items-center w-[54px] h-[54px] rounded-full text-white font-extrabold text-[12px] z-50"
          style={{ backgroundColor: "#C9363E", boxShadow: "0px 5px 16px 0px rgba(22, 58, 95, 0.08)" }}
        >
          SOS
        </button>
      </Link>

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
          <MapIcon size={22} color="#8793A0" />
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
