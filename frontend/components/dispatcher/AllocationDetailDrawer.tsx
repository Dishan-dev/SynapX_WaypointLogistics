"use client";

import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge, StatusVariant } from "./StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Truck, User, Package, Clock, Hash } from "lucide-react";

interface AllocationDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocation: any | null;
  onReassignDriver: () => void;
}

export function AllocationDetailDrawer({
  open,
  onOpenChange,
  allocation,
  onReassignDriver,
}: AllocationDetailDrawerProps) {
  if (!allocation) return null;

  const getStatusVariant = (status: string): StatusVariant => {
    switch (status.toLowerCase()) {
      case "allocated":
        return "primary";
      case "ready":
        return "success";
      case "loading":
        return "warning";
      case "dispatched":
      case "completed":
        return "success";
      case "cancelled":
      case "unavailable":
        return "destructive";
      default:
        return "neutral";
    }
  };

  const driverName = allocation.driver?.user?.full_name;
  const isDriverUnassigned = !driverName || driverName === "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">
              {allocation.vehicle?.code || "Allocation"}
            </SheetTitle>
            <StatusBadge
              status={allocation.status.charAt(0).toUpperCase() + allocation.status.slice(1)}
              variant={getStatusVariant(allocation.status)}
            />
          </div>
          <SheetDescription>
            {allocation.vehicle?.vehicle_type || "Vehicle"} — Allocation details
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Vehicle Details */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Truck className="h-4 w-4" /> Vehicle Info
            </h3>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Code</p>
                <p className="text-sm font-medium">{allocation.vehicle?.code || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm font-medium">{allocation.vehicle?.vehicle_type || "—"}</p>
              </div>
            </div>
          </div>

          {/* Driver Details */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <User className="h-4 w-4" /> Assigned Driver
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs shadow-none bg-background"
                onClick={onReassignDriver}
              >
                {isDriverUnassigned ? "Assign Driver" : "Reassign"}
              </Button>
            </div>

            {isDriverUnassigned ? (
              <div className="flex flex-col items-center justify-center p-4 text-muted-foreground text-sm border border-dashed rounded-md border-border/60">
                <p>No driver assigned</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-background border border-border p-3 rounded-md">
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{driverName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {allocation.driver?.license_type || "Licensed Driver"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Load & Run Details */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" /> Capacity & Run
            </h3>
            
            <div className="space-y-2 bg-background border border-border p-3 rounded-md">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Load Utilization</span>
                <span className="font-semibold">{allocation.load_percentage}%</span>
              </div>
              <Progress value={allocation.load_percentage} className="h-2 bg-muted" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Orders</p>
                <p className="text-sm font-medium">{allocation.orders?.length || 0}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Run ID</p>
                <p className="text-sm font-medium">{allocation.run_id || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Depart</p>
                <p className="text-sm font-medium">{allocation.departure_time || "—"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-6">
          <Button className="w-full">Confirm Allocation</Button>
          <Button variant="outline" className="w-full shadow-none">
            Edit Details
          </Button>
          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            Cancel Allocation
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
