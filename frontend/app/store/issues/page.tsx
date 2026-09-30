"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  Filter,
  X,
  Building2,
  User,
  Truck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StoreMetricCard } from "@/components/store/store-cards";

interface IssueItem {
  id: string;
  orderNumber: string;
  type: "short_delivery" | "damaged" | "wrong_items" | "temp_breach";
  title: string;
  description: string;
  reportedAt: string;
  reportedBy: string;
  status: "open" | "investigating" | "resolved" | "credit_issued";
  itemsAffected: string;
  claimedAmount?: string;
  driverName: string;
  vehicleId: string;
  resolutionNotes?: string;
}

const mockIssues: IssueItem[] = [
  {
    id: "ISS-001",
    orderNumber: "ORD0000001",
    type: "short_delivery",
    title: "5 Cartons Fresh Whole Milk Missing",
    description: "Warehouse loader reported picking shortage during vehicle loading. Only 35 of 40 cartons delivered to store.",
    reportedAt: "Today, 06:45 AM",
    reportedBy: "Warehouse Dock (Bay 3) & Store Manager",
    status: "investigating",
    itemsAffected: "Fresh Whole Milk 1L (SKU-99201) - 5 units short",
    driverName: "Kamal Perera",
    vehicleId: "VEH001",
  },
  {
    id: "ISS-002",
    orderNumber: "ORD0000002",
    type: "damaged",
    title: "2 Units Yogurt Crushed in Transit",
    description: "Cartons shifted during braking and containers split open. Rejected at store loading dock.",
    reportedAt: "Yesterday, 07:15 AM",
    reportedBy: "Sarah Jenkins (Store Manager)",
    status: "credit_issued",
    itemsAffected: "Greek Style Yogurt 500g (SKU-99204) - 2 units damaged",
    claimedAmount: "LKR 1,850.00",
    driverName: "Saman Kumara",
    vehicleId: "VEH004",
    resolutionNotes: "Credit Note #CN-99120 approved by Dispatch Supervisor.",
  },
  {
    id: "ISS-003",
    orderNumber: "ORD0000004",
    type: "temp_breach",
    title: "Reefer Unit Fluctuation (+6.2°C)",
    description: "Temperature sensor flagged 20 min excursion above +4°C during Colombo traffic delay.",
    reportedAt: "28 Sep 2026, 08:30 AM",
    reportedBy: "IoT Telemetry Auto-Flag",
    status: "resolved",
    itemsAffected: "Dairy & Chilled Goods Consignment",
    driverName: "Nimal Fernando",
    vehicleId: "VEH002",
    resolutionNotes: "Secondary QA inspection passed core temperature check at dock.",
  },
];

export default function ExceptionsAndIssuesPage() {
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null);

  const filtered = mockIssues.filter((iss) => {
    if (filter !== "ALL" && iss.status !== filter) return false;
    if (search && !iss.orderNumber.toLowerCase().includes(search.toLowerCase()) && !iss.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Exceptions &amp; Issues
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discrepancy logs, shortage notices from warehouse loaders, and store receiving reports.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StoreMetricCard
          label="Open / Investigating"
          value="1"
          caption="Shortfall on ORD0000001"
        />
        <StoreMetricCard
          label="Credit Notes Issued"
          value="1"
          caption="LKR 1,850.00 credited"
        />
        <StoreMetricCard
          label="Resolution Rate"
          value="67%"
          caption="2 of 3 issues closed"
        />
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter className="size-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-1.5">
            {["ALL", "investigating", "credit_issued", "resolved"].map((f) => (
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
                {f === "ALL" ? "All Exceptions" : f === "investigating" ? "Under Investigation" : f === "credit_issued" ? "Credit Issued" : "Resolved"}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search order or issue..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Issues List */}
      <div className="space-y-4">
        {filtered.map((issue) => {
          const isInvestigating = issue.status === "investigating" || issue.status === "open";
          const isCredit = issue.status === "credit_issued";

          return (
            <div
              key={issue.id}
              onClick={() => setSelectedIssue(issue)}
              className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all cursor-pointer space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-muted-foreground">
                      {issue.id}
                    </span>
                    <span className="font-extrabold text-sm text-foreground">
                      {issue.title}
                    </span>
                    <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {issue.orderNumber}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {issue.description}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                  {isInvestigating && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                      <Clock className="size-3" />
                      Investigating
                    </span>
                  )}
                  {isCredit && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="size-3" />
                      Credit Note Issued
                    </span>
                  )}
                  {!isInvestigating && !isCredit && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">
                      <CheckCircle2 className="size-3" />
                      Resolved
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-4 text-xs text-muted-foreground flex-wrap">
                <div>Affected: <strong className="text-foreground">{issue.itemsAffected}</strong></div>
                <div>Reported: <strong>{issue.reportedAt}</strong></div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Issue Details Drawer / Modal (Figma 07b Issue Details) */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-card border border-border rounded-2xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Exception Case {selectedIssue.id}
                </span>
                <h3 className="text-lg font-bold text-foreground">{selectedIssue.title}</h3>
                <span className="text-xs font-mono text-primary font-bold">{selectedIssue.orderNumber}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-muted/50 space-y-1">
                <div className="font-bold text-foreground">Incident Summary</div>
                <p className="text-muted-foreground">{selectedIssue.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-border space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Reported By</span>
                  <div className="font-semibold text-foreground">{selectedIssue.reportedBy}</div>
                </div>
                <div className="p-3 rounded-xl border border-border space-y-1">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold">Vehicle &amp; Driver</span>
                  <div className="font-semibold text-foreground">{selectedIssue.vehicleId} &bull; {selectedIssue.driverName}</div>
                </div>
              </div>

              {selectedIssue.resolutionNotes && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <span>Resolution &amp; Financial Settlement</span>
                  </div>
                  <p>{selectedIssue.resolutionNotes}</p>
                  {selectedIssue.claimedAmount && (
                    <div className="font-bold mt-1">Settlement Amount: {selectedIssue.claimedAmount}</div>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button type="button" onClick={() => setSelectedIssue(null)}>
                Close Details
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
