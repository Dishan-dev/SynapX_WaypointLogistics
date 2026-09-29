"use client";

import React, { useState, useEffect, useMemo } from "react";
import { type Order } from "@/types/order";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Snowflake, Package, Truck, Check, AlertTriangle, ShieldCheck } from "lucide-react";
import { fetchWithFallback } from "@/lib/api";

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

interface QuickAllocationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: Order[];
  onAllocationSuccess: () => void;
}

export function QuickAllocationDrawer({
  isOpen,
  onClose,
  selectedOrders,
  onAllocationSuccess,
}: QuickAllocationDrawerProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Total weight and temperature check
  const totalWeight = useMemo(() => {
    return selectedOrders.reduce((sum, o) => sum + (o.weight_kg || 0), 0);
  }, [selectedOrders]);

  const requiresChilled = useMemo(() => {
    return selectedOrders.some(
      (o) => o.temperature_zone?.toLowerCase() === "chilled" || o.temperature_zone?.toLowerCase() === "reefer"
    );
  }, [selectedOrders]);

  // Fetch available vehicles
  useEffect(() => {
    if (!isOpen) return;

    async function fetchVehicles() {
      try {
        const res = await fetchWithFallback("/api/v1/fleet/vehicles");
        if (res.ok) {
          const data: Vehicle[] = await res.json();
          setVehicles(data);
          // Auto select first compatible vehicle
          const compatible = data.find((v) => {
            const isTempMatch = !requiresChilled || v.temperature_mode?.toLowerCase() === "reefer";
            const isAvail = v.status?.toLowerCase() !== "unavailable";
            return isTempMatch && isAvail;
          });
          if (compatible) {
            setSelectedVehicleId(compatible.id);
          }
        }
      } catch (err) {
        console.error("Failed to load vehicles:", err);
      }
    }

    fetchVehicles();
  }, [isOpen, requiresChilled]);

  const handleConfirmAllocation = async () => {
    if (!selectedVehicleId || selectedOrders.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Bulk allocate orders via API
      const res = await fetchWithFallback("/api/v1/orders/bulk-allocate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order_ids: selectedOrders.map((o) => o.id),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to allocate orders");
      }

      onAllocationSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Allocation error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg p-0 flex flex-col h-full bg-card">
        {/* Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-xl font-bold text-foreground">Allocate Selected Orders</SheetTitle>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-[#18385F] border border-slate-300">
              Compatible only
            </span>
          </div>
          <SheetDescription className="mt-1 text-sm text-muted-foreground flex items-center gap-2">
            <span>{selectedOrders.length} {selectedOrders.length === 1 ? "order" : "orders"}</span>
            <span>·</span>
            <span className="font-semibold text-foreground">{Math.round(totalWeight)} kg</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 font-medium">
              {requiresChilled ? (
                <>
                  <Snowflake className="size-3 text-sky-600" />
                  Chilled Required
                </>
              ) : (
                <>
                  <Package className="size-3 text-slate-500" />
                  Ambient Compatible
                </>
              )}
            </span>
          </SheetDescription>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Selected Orders Section */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Selected Orders ({selectedOrders.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {selectedOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30"
                >
                  <div>
                    <div className="font-semibold text-xs text-[#18385F] dark:text-sky-400">
                      {order.order_number} · {order.client_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {order.district || "Colombo"} · {order.delivery_window || "Standard window"}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-foreground">{Math.round(order.weight_kg)} kg</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compatible Vehicles Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Compatible Fleet Vehicles
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {vehicles.length} in fleet
              </span>
            </div>

            <div className="space-y-2.5">
              {vehicles.map((v) => {
                const isTempCompatible = !requiresChilled || v.temperature_mode?.toLowerCase() === "reefer";
                const isOperational = v.status?.toLowerCase() !== "unavailable";
                const isEligible = isTempCompatible && isOperational;

                // Simulated load percentage calculation
                const baseWeight = v.capacity_kg * 0.45; // simulated existing load
                const projectedPct = Math.min(100, Math.round(((baseWeight + totalWeight) / v.capacity_kg) * 100));

                let matchBadge = null;
                if (!isTempCompatible) {
                  matchBadge = (
                    <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                      Temp mismatch
                    </span>
                  );
                } else if (!isOperational) {
                  matchBadge = (
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                      Under maintenance
                    </span>
                  );
                } else if (projectedPct > 90) {
                  matchBadge = (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Near limit
                    </span>
                  );
                } else {
                  matchBadge = (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Best match
                    </span>
                  );
                }

                const isSelected = selectedVehicleId === v.id;

                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      if (isEligible) setSelectedVehicleId(v.id);
                    }}
                    className={`relative flex items-center justify-between p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? "border-[#18385F] bg-sky-50/50 dark:bg-sky-950/30 ring-1 ring-[#18385F]"
                        : isEligible
                        ? "border-border hover:border-slate-400 cursor-pointer bg-card"
                        : "border-border/60 bg-muted/40 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`size-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? "border-[#18385F] bg-[#18385F] text-white"
                            : "border-slate-300 bg-card"
                        }`}
                      >
                        {isSelected && <div className="size-1.5 rounded-full bg-white" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{v.code}</span>
                          <span className="text-xs text-muted-foreground capitalize">
                            · {v.vehicle_type} ({v.temperature_mode})
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Capacity: {v.capacity_kg} kg · Depot: {v.depot_name}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      {isEligible ? (
                        <>
                          <span className="text-xs font-semibold text-foreground">
                            {projectedPct}% after allocation
                          </span>
                          {matchBadge}
                        </>
                      ) : (
                        matchBadge
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 text-xs rounded-md bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t border-border bg-card flex flex-row items-center justify-end gap-3 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirmAllocation}
            disabled={!selectedVehicleId || isSubmitting}
            className="bg-[#18385F] hover:bg-[#122b49] text-white text-xs h-9 px-5 transition-all"
          >
            {isSubmitting ? "Allocating..." : "Confirm Allocation"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
