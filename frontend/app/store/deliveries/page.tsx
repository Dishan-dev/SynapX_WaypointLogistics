"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Truck,
  Package,
  ThermometerSnowflake,
  Sun,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Filter,
  ShieldCheck,
  User,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorePill } from "@/components/store/status-pill";
import { StoreMetricCard } from "@/components/store/store-cards";

interface DeliveryItem {
  id: string;
  orderNumber: string;
  brand: string;
  tempRequirement: "chilled" | "ambient";
  driverName: string;
  driverPhone: string;
  vehicleId: string;
  vehiclePlate: string;
  currentLocation: string;
  estimatedArrival: string;
  window: string;
  status: "in_transit" | "arriving_soon" | "at_dock" | "delivered" | "delayed";
  totalUnits: number;
  totalWeightKg: number;
  coldChainTemp?: string;
  sealNumber: string;
}

const mockDeliveries: DeliveryItem[] = [
  {
    id: "del-001",
    orderNumber: "ORD0000001",
    brand: "Fresh",
    tempRequirement: "chilled",
    driverName: "Kamal Perera",
    driverPhone: "+94 77 123 4567",
    vehicleId: "VEH001",
    vehiclePlate: "WP-GA-4892",
    currentLocation: "1.2 km away (Maradana Junction)",
    estimatedArrival: "06:45 AM (in 15 mins)",
    window: "04:00 – 07:45",
    status: "arriving_soon",
    totalUnits: 40,
    totalWeightKg: 120.5,
    coldChainTemp: "+3.8°C (Normal)",
    sealNumber: "SL-994021",
  },
  {
    id: "del-002",
    orderNumber: "ORD0000002",
    brand: "Fresh",
    tempRequirement: "ambient",
    driverName: "Saman Kumara",
    driverPhone: "+94 71 987 6543",
    vehicleId: "VEH004",
    vehiclePlate: "WP-ND-3310",
    currentLocation: "Loading Dock 2",
    estimatedArrival: "Arrived",
    window: "04:00 – 07:45",
    status: "at_dock",
    totalUnits: 25,
    totalWeightKg: 80.0,
    sealNumber: "SL-884019",
  },
  {
    id: "del-003",
    orderNumber: "ORD0000003",
    brand: "Style",
    tempRequirement: "ambient",
    driverName: "Nimal Fernando",
    driverPhone: "+94 76 555 1212",
    vehicleId: "VEH012",
    vehiclePlate: "WP-LY-7721",
    currentLocation: "Departed Peliyagoda Hub",
    estimatedArrival: "10:30 AM",
    window: "09:00 – 12:00",
    status: "in_transit",
    totalUnits: 15,
    totalWeightKg: 45.0,
    sealNumber: "SL-772014",
  },
];

export default function IncomingDeliveriesPage() {
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const filtered = mockDeliveries.filter((d) => {
    if (filter !== "ALL" && d.status !== filter) return false;
    if (search && !d.orderNumber.toLowerCase().includes(search.toLowerCase()) && !d.driverName.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Incoming Deliveries
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time tracking of dispatch vehicles, cold-chain integrity, and active receiving dock status.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StoreMetricCard
          label="Active Vehicles En Route"
          value="2"
          caption="1 arriving within 20 mins"
        />
        <StoreMetricCard
          label="At Loading Dock"
          value="1"
          caption="ORD0000002 ready to receive"
        />
        <StoreMetricCard
          label="Cold-Chain Verified"
          value="100%"
          caption="All chilled containers in spec"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="size-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1.5 overflow-x-auto w-full">
            {["ALL", "at_dock", "arriving_soon", "in_transit"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  filter === f
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "ALL" ? "All Deliveries" : f === "at_dock" ? "At Dock (Ready)" : f === "arriving_soon" ? "Arriving Soon" : "In Transit"}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search order or driver..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Deliveries List */}
      <div className="space-y-4">
        {filtered.map((del) => {
          const isAtDock = del.status === "at_dock";
          const isArriving = del.status === "arriving_soon";

          return (
            <div
              key={del.id}
              className={`bg-card border rounded-2xl p-5 sm:p-6 shadow-xs transition-all hover:shadow-md ${
                isAtDock
                  ? "border-amber-400 dark:border-amber-700 bg-amber-50/15"
                  : "border-border"
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Order Info & Status */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base font-extrabold text-foreground">
                      {del.orderNumber}
                    </span>
                    <span className="text-xs font-mono font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                      {del.vehicleId} ({del.vehiclePlate})
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                        del.brand.toLowerCase() === "fresh"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                          : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                      }`}
                    >
                      {del.brand}
                    </span>
                    {del.tempRequirement === "chilled" ? (
                      <span className="inline-flex items-center gap-1 text-xs text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/50 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                        <ThermometerSnowflake className="size-3" />
                        Chilled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                        <Sun className="size-3" />
                        Ambient
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      Delivery Window: <strong>{del.window}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Radio className="size-3.5 text-teal-600 animate-pulse" />
                      Location: <strong>{del.currentLocation}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="size-3.5" />
                      Driver: <strong>{del.driverName}</strong> ({del.driverPhone})
                    </span>
                  </div>
                </div>

                {/* Right: ETA & Action Button */}
                <div className="flex items-center gap-3 self-start lg:self-auto shrink-0">
                  <div className="text-right hidden sm:block">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                      Estimated Arrival
                    </div>
                    <div className="text-sm font-black text-foreground">
                      {del.estimatedArrival}
                    </div>
                  </div>

                  <Button asChild size="default" className={isAtDock ? "bg-amber-600 hover:bg-amber-700 text-white font-bold" : "bg-primary text-primary-foreground font-semibold"}>
                    <Link href={`/store/deliveries/${del.orderNumber}`}>
                      <span>{isAtDock ? "Receive & Verify Goods" : "View Tracking"}</span>
                      <ArrowRight className="size-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Specs & Cold Chain Integrity footer */}
              <div className="mt-4 pt-3.5 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Units:</span>{" "}
                  <strong className="text-foreground">{del.totalUnits} cartons</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Weight:</span>{" "}
                  <strong className="text-foreground">{del.totalWeightKg} kg</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Container Seal:</span>{" "}
                  <strong className="text-foreground font-mono">{del.sealNumber}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Temp Telemetry:</span>{" "}
                  <strong className={del.coldChainTemp ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}>
                    {del.coldChainTemp || "Ambient"}
                  </strong>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
