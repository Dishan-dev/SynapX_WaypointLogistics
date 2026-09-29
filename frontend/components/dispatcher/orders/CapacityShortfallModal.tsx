"use client";

import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import Link from "next/link";

interface CapacityShortfallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeferAffected?: () => void;
}

export function CapacityShortfallModal({
  isOpen,
  onClose,
  onDeferAffected,
}: CapacityShortfallModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[480px] w-full p-6 rounded-[14px] bg-white border border-[#E5E5E2] shadow-2xl text-[#171A1F] overflow-hidden"
      >
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-[20px] font-semibold tracking-tight text-[#171A1F]">
            Capacity Shortfall
          </h2>
          <p className="text-[12px] text-[#6B7280]">
            Not every confirmed order can be served with today&apos;s feasible fleet.
          </p>
        </div>

        <div className="w-full h-px bg-[#E5E5E2] my-2" />

        {/* Badge & Impact */}
        <div className="space-y-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide bg-[#FDF2F2] text-[#DC2626] border border-[#FEE2E2]">
            ACTION REQUIRED
          </span>
          <div className="text-[13px] font-semibold text-[#171A1F]">
            4 orders cannot be served today
          </div>
          <p className="text-[11px] text-[#6B7280]">
            The current fleet cannot satisfy all confirmed demand without breaking one or more operating constraints.
          </p>
        </div>

        {/* Constraint breakdowns */}
        <div className="space-y-2 mt-2">
          <div className="p-3 rounded-[7px] bg-[#FDF2F2] border border-[#FEE2E2]">
            <div className="text-[11px] font-semibold text-[#DC2626]">2 chilled orders</div>
            <div className="text-[10px] text-[#6B7280] mt-0.5">No remaining reefer capacity</div>
          </div>

          <div className="p-3 rounded-[7px] bg-[#FBF6EC] border border-[#EBE3D3]">
            <div className="text-[11px] font-semibold text-[#A37A3B]">1 van-only outlet</div>
            <div className="text-[10px] text-[#6B7280] mt-0.5">Compatible van already at trip limit</div>
          </div>

          <div className="p-3 rounded-[7px] bg-[#FBF6EC] border border-[#EBE3D3]">
            <div className="text-[11px] font-semibold text-[#A37A3B]">1 ambient order</div>
            <div className="text-[10px] text-[#6B7280] mt-0.5">Fuel quota / trip limit leaves no feasible vehicle</div>
          </div>
        </div>

        {/* Affected orders */}
        <div className="space-y-1.5 mt-2">
          <div className="text-[12px] font-semibold text-[#171A1F]">Affected orders</div>

          <div className="p-2.5 rounded-[7px] bg-[#F6F6F3] border border-[#E5E5E2] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#18385F]">OUT044 · Fresh Mart</span>
            <span className="text-[10px] text-[#6B7280]">Chilled · early delivery window</span>
          </div>

          <div className="p-2.5 rounded-[7px] bg-[#F6F6F3] border border-[#E5E5E2] flex items-center justify-between">
            <span className="text-[11px] font-semibold text-[#18385F]">OUT071 · Style Hub</span>
            <span className="text-[10px] text-[#6B7280]">Access-constrained outlet</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2.5 pt-3 mt-1 border-t border-[#E5E5E2]">
          <Link href="/dispatcher/allocations">
            <Button
              type="button"
              variant="outline"
              className="h-10 text-xs font-semibold text-[#171A1F] border-[#E5E5E2] hover:bg-slate-50"
            >
              Rebalance Allocations
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-10 text-xs text-[#6B7280]"
            >
              Close
            </Button>

            {onDeferAffected && (
              <Button
                type="button"
                onClick={() => {
                  onDeferAffected();
                  onClose();
                }}
                className="h-10 px-4 text-xs font-semibold bg-[#18385F] hover:bg-[#122b49] text-white"
              >
                Defer Selected
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
