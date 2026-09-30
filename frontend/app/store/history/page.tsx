"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  History,
  FileCheck2,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  ThermometerSnowflake,
  Sun,
  Eye,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface HistoryItem {
  orderNumber: string;
  deliveredDate: string;
  brand: string;
  units: number;
  weightKg: number;
  driverName: string;
  vehicleId: string;
  signedBy: string;
  status: "completed_clean" | "completed_with_issue";
  issueNote?: string;
}

const mockHistory: HistoryItem[] = [
  {
    orderNumber: "ORD0000002",
    deliveredDate: "Today, 07:15 AM",
    brand: "Fresh",
    units: 25,
    weightKg: 80.0,
    driverName: "Saman Kumara",
    vehicleId: "VEH004",
    signedBy: "Sarah Jenkins",
    status: "completed_with_issue",
    issueNote: "2 units yogurt damaged (Credit Note #CN-99120)",
  },
  {
    orderNumber: "ORD0000004",
    deliveredDate: "28 Sep 2026, 06:40 AM",
    brand: "Fresh",
    units: 40,
    weightKg: 130.0,
    driverName: "Kamal Perera",
    vehicleId: "VEH001",
    signedBy: "Sarah Jenkins",
    status: "completed_clean",
  },
  {
    orderNumber: "ORD0000006",
    deliveredDate: "25 Sep 2026, 11:20 AM",
    brand: "Style",
    units: 18,
    weightKg: 55.0,
    driverName: "Nimal Fernando",
    vehicleId: "VEH012",
    signedBy: "Sarah Jenkins",
    status: "completed_clean",
  },
  {
    orderNumber: "ORD0000008",
    deliveredDate: "22 Sep 2026, 02:15 PM",
    brand: "Tech",
    units: 8,
    weightKg: 110.0,
    driverName: "Rohan Silva",
    vehicleId: "VEH020",
    signedBy: "Sarah Jenkins",
    status: "completed_clean",
  },
];

export default function DeliveryHistoryPage() {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");

  const filtered = mockHistory.filter((h) => {
    if (brandFilter !== "ALL" && h.brand.toLowerCase() !== brandFilter.toLowerCase()) return false;
    if (search && !h.orderNumber.toLowerCase().includes(search.toLowerCase()) && !h.driverName.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Delivery History
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Archive of received consignments, signed digital receipts, and audit trail.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter className="size-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1.5">
            {["ALL", "Fresh", "Style", "Tech"].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrandFilter(b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  brandFilter === b
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {b === "ALL" ? "All Brands" : b}
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

      {/* History Table / Cards */}
      <div className="space-y-3">
        {filtered.map((item) => {
          const isClean = item.status === "completed_clean";

          return (
            <div
              key={item.orderNumber}
              className="bg-card border border-border rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-extrabold text-base text-foreground">
                    {item.orderNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-semibold border ${
                      item.brand.toLowerCase() === "fresh"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                        : item.brand.toLowerCase() === "style"
                        ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
                        : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                    }`}
                  >
                    {item.brand}
                  </span>

                  {isClean ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="size-3" />
                      Received in Full
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                      Discrepancy Logged
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>Delivered: <strong>{item.deliveredDate}</strong></span>
                  <span>&bull;</span>
                  <span>Units: <strong>{item.units}</strong> ({item.weightKg} kg)</span>
                  <span>&bull;</span>
                  <span>Vehicle: <strong>{item.vehicleId}</strong></span>
                  <span>&bull;</span>
                  <span>Signed by: <strong>{item.signedBy}</strong></span>
                </div>

                {item.issueNote && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                    &bull; Note: {item.issueNote}
                  </p>
                )}
              </div>

              <div className="shrink-0 self-end sm:self-auto">
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={`/store/deliveries/${item.orderNumber}`}>
                    <Eye className="size-3.5" />
                    <span>View Receipt</span>
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
