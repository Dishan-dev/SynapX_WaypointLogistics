"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, X } from "lucide-react";

interface AllocationSuccessBannerProps {
  allocatedCount: number;
  vehicleCode: string;
  onDismiss: () => void;
}

export function AllocationSuccessBanner({
  allocatedCount,
  vehicleCode,
  onDismiss,
}: AllocationSuccessBannerProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed top-4 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-300 w-[380px] p-3.5 px-4 rounded-[8px] bg-[#F0FDF4] border border-[#DCFCE7] shadow-lg text-[#171A1F] flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="size-4 text-[#166534] shrink-0 mt-0.5" />
        <div>
          <div className="text-[13px] font-semibold text-[#166534]">
            {allocatedCount} {allocatedCount === 1 ? "order" : "orders"} allocated to {vehicleCode}
          </div>
          <div className="text-[11px] text-[#6B7280] mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>Selection cleared · allocation is now visible in</span>
            <Link
              href="/dispatcher/allocations"
              className="text-[#18385F] font-semibold hover:underline inline-flex items-center gap-0.5"
            >
              Allocations
              <ArrowRight className="size-2.5" />
            </Link>
          </div>
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="text-[#6B7280] hover:text-[#171A1F] p-0.5 rounded transition-colors"
        aria-label="Dismiss banner"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
