"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Signal, BatteryFull, PackageCheck, PackageMinus, TriangleAlert, Check,
  Map as MapIcon, Home, Layers
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { fetchStopDetail, type StopDetail } from "@/lib/driverStop";
import StopDeliveryDetails from "@/components/driver/StopDeliveryDetails";

function DeliveryOutcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stopId = searchParams.get("stop_id");

  const [selectedOutcome, setSelectedOutcome] = useState("full");
  const [stop, setStop] = useState<StopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!stopId) return;
    fetchStopDetail(stopId)
      .then((detail) => {
        // POD already captured (e.g. driver pressed back) — nothing left to do here
        if (detail.pod) {
          router.replace("/driver/trip");
          return;
        }
        setStop(detail);
        if (detail.status === "partial") setSelectedOutcome("partial");
        if (detail.status === "failed") setSelectedOutcome("issue");
      })
      .catch((error) => console.error("Failed to fetch stop data:", error))
      .finally(() => setLoading(false));
  }, [stopId, router]);

  async function handleContinue() {
    if (!stopId) return;
    setSubmitting(true);

    let backendOutcome = "delivered";
    if (selectedOutcome === "partial") backendOutcome = "partial";
    if (selectedOutcome === "issue") backendOutcome = "failed";

    try {
      await apiFetch(`/driver/stops/${stopId}/outcome`, {
        method: "PATCH",
        body: JSON.stringify({ outcome: backendOutcome })
      });
      // A failed stop has no proof of delivery — the driver reports why instead
      router.push(
        backendOutcome === "failed"
          ? `/driver/report?stop_id=${stopId}`
          : `/driver/trip/proof?stop_id=${stopId}`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the outcome");
      setSubmitting(false);
    }
  }

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
              {loading ? "Loading..." : stop?.customer_name || "Unknown Stop"}
            </h1>
            <p className="text-[12px] font-normal leading-[1.45em] truncate max-w-full" style={{ color: "#5D6A78" }}>
              {loading ? "..." : stop?.address}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div 
        className="flex flex-col flex-1 bg-white px-5 pb-5 pt-4 gap-[14px] z-20 relative overflow-y-auto"
        style={{ boxShadow: "0px -8px 28px 0px rgba(11, 39, 67, 0.16)" }}
      >

        {/* What is being delivered here */}
        {loading ? (
          <div className="w-full h-[120px] rounded-xl animate-pulse shrink-0" style={{ backgroundColor: "#F2F5F8" }} />
        ) : stop ? (
          <StopDeliveryDetails stop={stop} />
        ) : (
          <div className="w-full p-3 rounded-xl text-[12px] shrink-0" style={{ backgroundColor: "#FFF4D6", color: "#A85D00" }}>
            Couldn&apos;t load this stop&apos;s delivery details.
          </div>
        )}

        {/* Primary Action Button */}
        <div className="mt-auto pt-2 shrink-0">
          <button
            onClick={handleContinue}
            disabled={submitting || loading || !stop}
            className="w-full flex justify-center items-center h-[55px] rounded-lg text-white font-bold text-[16px] disabled:opacity-50"
            style={{ backgroundColor: "#092C4C" }}
          >
            {submitting ? "Saving..." : "Continue to proof of delivery"}
          </button>
        </div>
      </div>

    </div>
  );
}

export default function DeliveryOutcomePage() {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <DeliveryOutcomeContent />
    </React.Suspense>
  );
}
