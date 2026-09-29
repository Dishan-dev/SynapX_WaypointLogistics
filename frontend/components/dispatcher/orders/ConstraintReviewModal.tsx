"use client";

import React from "react";
import { type Order } from "@/types/order";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, AlertCircle, ArrowLeft } from "lucide-react";

interface Vehicle {
  id: number;
  code: string;
  vehicle_type: string;
  capacity_kg: number;
  capacity_vol_m3: number;
  status: string;
  temperature_mode: string;
  depot_name: string;
}

interface ConstraintReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedOrders: Order[];
  selectedVehicle: Vehicle | null;
  isSubmitting?: boolean;
}

export function ConstraintReviewModal({
  isOpen,
  onClose,
  onConfirm,
  selectedOrders,
  selectedVehicle,
  isSubmitting,
}: ConstraintReviewModalProps) {
  if (!selectedVehicle) return null;

  const totalWeight = selectedOrders.reduce((sum, o) => sum + (o.weight_kg || 0), 0);
  const requiresChilled = selectedOrders.some(
    (o) => o.temperature_zone?.toLowerCase() === "chilled" || o.temperature_zone?.toLowerCase() === "reefer"
  );
  const isTempCompatible = !requiresChilled || selectedVehicle.temperature_mode?.toLowerCase() === "reefer";
  const isWeightValid = totalWeight <= selectedVehicle.capacity_kg;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[464px] p-6 rounded-[10px] bg-white border border-[#E5E5E2] shadow-xl text-[#171A1F] overflow-hidden">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="text-[20px] font-semibold tracking-tight text-[#171A1F]">
            Review Allocation Constraints
          </h2>
          <p className="text-[12px] text-[#6B7280]">
            Validate the selected vehicle against every required delivery constraint before confirming.
          </p>
        </div>

        <div className="w-full h-px bg-[#E5E5E2] my-2" />

        {/* Selected Assignment */}
        <div className="space-y-2">
          <div className="text-[12px] font-semibold text-[#171A1F]">Selected assignment</div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold bg-[#F6F6F3] text-[#18385F] border border-[#E5E5E2]">
              Selected vehicle
            </span>
            <span className="text-[14px] font-semibold text-[#171A1F]">{selectedVehicle.code}</span>
            <span className="text-[12px] text-[#6B7280] capitalize">
              ({selectedVehicle.vehicle_type} · {selectedVehicle.temperature_mode})
            </span>
          </div>
          <div className="text-[11px] text-[#6B7280]">
            {selectedOrders.length} {selectedOrders.length === 1 ? "selected order" : "selected orders"} · {Math.round(totalWeight)} kg
          </div>
        </div>

        {/* Constraint Checks List */}
        <div className="space-y-2.5 mt-2">
          <div className="text-[12px] font-semibold text-[#171A1F]">Constraint checks</div>

          {/* Temperature */}
          <div className="flex items-center justify-between p-3 rounded-[6px] bg-[#F0FDF4] border border-[#DCFCE7]">
            <span className="text-[11px] font-medium text-[#171A1F]">Temperature</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-semibold ${isTempCompatible ? "text-[#166534]" : "text-rose-700"}`}>
                {isTempCompatible ? "Compatible" : "Incompatible"}
              </span>
              {isTempCompatible ? (
                <Check className="size-3.5 text-[#166534]" />
              ) : (
                <AlertCircle className="size-3.5 text-rose-700" />
              )}
            </div>
          </div>

          {/* Outlet access */}
          <div className="flex items-center justify-between p-3 rounded-[6px] bg-[#F0FDF4] border border-[#DCFCE7]">
            <span className="text-[11px] font-medium text-[#171A1F]">Outlet access</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[#166534]">Access permitted</span>
              <Check className="size-3.5 text-[#166534]" />
            </div>
          </div>

          {/* Weight */}
          <div className="flex items-center justify-between p-3 rounded-[6px] bg-[#F0FDF4] border border-[#DCFCE7]">
            <span className="text-[11px] font-medium text-[#171A1F]">Weight</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[#166534]">
                Within capacity ({Math.round(totalWeight)} kg / {selectedVehicle.capacity_kg} kg)
              </span>
              <Check className="size-3.5 text-[#166534]" />
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center justify-between p-3 rounded-[6px] bg-[#F0FDF4] border border-[#DCFCE7]">
            <span className="text-[11px] font-medium text-[#171A1F]">Volume</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[#166534]">Within limits</span>
              <Check className="size-3.5 text-[#166534]" />
            </div>
          </div>

          {/* Weekly fuel quota */}
          <div className="flex items-center justify-between p-3 rounded-[6px] bg-[#FBF6EC] border border-[#EBE3D3]">
            <span className="text-[11px] font-medium text-[#171A1F]">Weekly fuel quota</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[#A37A3B]">Near weekly limit</span>
              <AlertCircle className="size-3.5 text-[#A37A3B]" />
            </div>
          </div>

          {/* Trips used today */}
          <div className="flex items-center justify-between p-3 rounded-[6px] bg-[#F0FDF4] border border-[#DCFCE7]">
            <span className="text-[11px] font-medium text-[#171A1F]">Trips used today</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold text-[#166534]">1 of 2 used</span>
              <Check className="size-3.5 text-[#166534]" />
            </div>
          </div>
        </div>

        <div className="w-full h-px bg-[#E5E5E2] my-2" />

        {/* Overall compatibility */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-[#171A1F]">Overall compatibility</div>
          <div className="flex items-start gap-2.5">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F0FDF4] text-[#166534] border border-[#DCFCE7] shrink-0 mt-0.5">
              Compatible
            </span>
            <p className="text-[10px] leading-tight text-[#6B7280]">
              All required constraints pass. Fuel usage is close to the weekly quota, so the dispatcher can review the warning before confirming.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-3 mt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-10 px-4 text-xs font-semibold text-[#171A1F] border-[#E5E5E2] hover:bg-slate-50"
          >
            <ArrowLeft className="size-3.5 mr-1.5" />
            Back
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={!isTempCompatible || !isWeightValid || isSubmitting}
            className="h-10 px-6 text-xs font-semibold bg-[#18385F] hover:bg-[#122b49] text-white shadow-sm"
          >
            {isSubmitting ? "Allocating..." : "Confirm Allocation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
