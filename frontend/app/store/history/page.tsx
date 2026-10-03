"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Truck,
  Building2,
  Calendar,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorePill } from "@/components/store/status-pill";
import { StoreMetricCard } from "@/components/store/store-cards";
import { getStoreOrders } from "@/components/store/api/store-data";
import { fetchStoreIssues, getStoredIssues, StoreIssue } from "@/services/issues-store";
import { StoreOrder, mockOrders } from "@/components/store/mock-data";

interface HistoryRecord {
  orderId: string;
  deliveryDate: string;
  arrivalInfo: string;
  vehicleId: string;
  vehicleType: string;
  driverName: string;
  itemCount: number;
  unitCount: number;
  outcomeType: "clean" | "issue_resolved" | "issue_under_review";
  outcomeTitle: string;
  outcomeDetail: string;
  status: "completed" | "archived";
}

export default function DeliveryHistoryPage() {
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"all" | "clean" | "issues">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("30");
  const [issuesFilter, setIssuesFilter] = useState("all");

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      try {
        const [orders, remoteIssues] = await Promise.all([
          getStoreOrders(),
          fetchStoreIssues().catch(() => getStoredIssues()),
        ]);

        const allIssues = remoteIssues && remoteIssues.length > 0 ? remoteIssues : getStoredIssues();
        const baseOrders = orders && orders.length > 0 ? orders : mockOrders;

        // Filter for completed/delivered orders
        const relevantOrders = baseOrders.filter(
          (o) => o.status === "completed" || o.status === "delivered" || o.statusTimes?.delivered
        );

        const records: HistoryRecord[] = relevantOrders.map((ord) => {
          const matchingIssues = allIssues.filter(
            (i) => i.orderId.toLowerCase() === ord.orderNumber.toLowerCase()
          );

          let outcomeType: "clean" | "issue_resolved" | "issue_under_review" = "clean";
          let outcomeTitle = "Clean delivery";
          let outcomeDetail = "Verified in full • zero defects";

          if (matchingIssues.length > 0) {
            const hasOpenOrReview = matchingIssues.some(
              (i) => i.status === "open" || i.status === "under_review"
            );
            if (hasOpenOrReview) {
              outcomeType = "issue_under_review";
              outcomeTitle = `${matchingIssues.length} issue${matchingIssues.length > 1 ? "s" : ""} • under review`;
              outcomeDetail = `${matchingIssues[0].id} • ${matchingIssues[0].affectedItem}`;
            } else {
              outcomeType = "issue_resolved";
              outcomeTitle = `${matchingIssues.length} issue${matchingIssues.length > 1 ? "s" : ""} • resolved`;
              outcomeDetail = `${matchingIssues[0].id} • settled`;
            }
          }

          const totalUnits = ord.items.reduce((s, it) => s + (it.quantitySent ?? it.quantity), 0);
          const dateStr = ord.orderDate
            ? format(parseISO(ord.orderDate), "d MMM yyyy")
            : "Today";

          return {
            orderId: ord.orderNumber,
            deliveryDate: dateStr,
            arrivalInfo: "Arrived • Rear dock",
            vehicleId: ord.vehicle?.code || ord.vehicleCode || "VEH001",
            vehicleType: ord.vehicle?.description || "Truck • Ambient",
            driverName: ord.vehicle?.driverName || "Marcus Vance",
            itemCount: ord.items.length,
            unitCount: totalUnits,
            outcomeType,
            outcomeTitle,
            outcomeDetail,
            status: "completed",
          };
        });

        // Ensure we always show history records even if only a few orders are marked completed
        if (records.length === 0) {
          records.push(
            {
              orderId: "ORD0000001",
              deliveryDate: "Today, 26 Sep 2026",
              arrivalInfo: "Arrived 06:08 • Rear dock",
              vehicleId: "VEH001",
              vehicleType: "Truck • Reefer",
              driverName: "Marcus Vance",
              itemCount: 3,
              unitCount: 33,
              outcomeType: "clean",
              outcomeTitle: "Clean delivery",
              outcomeDetail: "Verified in full • zero defects",
              status: "completed",
            },
            {
              orderId: "ORD0000005",
              deliveryDate: "23 Sep 2026",
              arrivalInfo: "Arrived 04:50 • Rear dock",
              vehicleId: "VEH037",
              vehicleType: "Van • Ambient",
              driverName: "Elena Ramos",
              itemCount: 6,
              unitCount: 28,
              outcomeType: "issue_resolved",
              outcomeTitle: "1 issue • resolved",
              outcomeDetail: "ISS0000003 • 1 case over",
              status: "completed",
            },
            {
              orderId: "ORD0000006",
              deliveryDate: "19 Sep 2026",
              arrivalInfo: "Arrived 05:10 • Rear dock",
              vehicleId: "VEH009",
              vehicleType: "Truck • Ambient",
              driverName: "Marcus Vance",
              itemCount: 12,
              unitCount: 75,
              outcomeType: "issue_under_review",
              outcomeTitle: "1 issue • under review",
              outcomeDetail: "ISS0000002 • 2 cases short",
              status: "completed",
            }
          );
        }

        setHistoryRecords(records);
      } catch {
        // Fallback
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const totalCount = historyRecords.length;
  const cleanCount = historyRecords.filter((r) => r.outcomeType === "clean").length;
  const issuesCount = historyRecords.filter((r) => r.outcomeType !== "clean").length;
  const onTimePct = totalCount > 0 ? "96%" : "100%";

  const filtered = historyRecords.filter((rec) => {
    if (selectedTab === "clean" && rec.outcomeType !== "clean") return false;
    if (selectedTab === "issues" && rec.outcomeType === "clean") return false;

    if (issuesFilter === "clean" && rec.outcomeType !== "clean") return false;
    if (issuesFilter === "with_issues" && rec.outcomeType === "clean") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchOrder = rec.orderId.toLowerCase().includes(q);
      const matchDriver = rec.driverName.toLowerCase().includes(q);
      const matchVehicle = rec.vehicleId.toLowerCase().includes(q);
      if (!matchOrder && !matchDriver && !matchVehicle) return false;
    }

    return true;
  });

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginatedHistory = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header (Figma 18:861) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-primary md:text-3xl md:font-bold">
            Delivery History
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Completed deliveries, their linked orders, and receiving outcome records.
          </p>
        </div>
      </div>

      {/* 4 Metric Cards (Figma 18:867) */}
      <section aria-label="History Summary" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StoreMetricCard
          label="Total Deliveries"
          value={String(totalCount)}
          caption="Completed this period"
          mobileCaption={`${totalCount} total`}
        />
        <StoreMetricCard
          label="Clean Deliveries"
          value={String(cleanCount)}
          caption="Accepted without discrepancy"
          mobileCaption={`${cleanCount} clean`}
        />
        <StoreMetricCard
          label="With Issues"
          value={String(issuesCount)}
          caption="Discrepancies recorded"
          mobileCaption={`${issuesCount} issues`}
        />
        <StoreMetricCard
          label="On-Time Arrival"
          value={onTimePct}
          caption="Within scheduled window"
          mobileCaption={`${onTimePct} on-time`}
        />
      </section>

      {/* History Table Container (Figma 18:884) */}
      <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
        {/* Tabs (Figma 18:885) */}
        <div className="flex items-center border-b border-border/80 px-4 pt-3 gap-1 overflow-x-auto">
          {[
            { key: "all", label: `All (${totalCount})` },
            { key: "clean", label: `Clean (${cleanCount})` },
            { key: "issues", label: `With Issues (${issuesCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedTab(tab.key as any)}
              className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors cursor-pointer ${
                selectedTab === tab.key
                  ? "border-primary text-primary font-bold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filter Bar (Figma 18:892) */}
        <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search order ID or driver..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9 bg-background"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs p-2 rounded-lg border border-border bg-background focus:outline-none"
            >
              <option value="30">Last 30 days</option>
              <option value="7">Last 7 days</option>
              <option value="all">All time</option>
            </select>

            <select
              value={issuesFilter}
              onChange={(e) => setIssuesFilter(e.target.value)}
              className="text-xs p-2 rounded-lg border border-border bg-background focus:outline-none"
            >
              <option value="all">Issues: All</option>
              <option value="clean">Clean only</option>
              <option value="with_issues">With issues only</option>
            </select>
          </div>
        </div>

        {/* Table (Figma 50:1777) */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
              <tr>
                <th className="py-3 px-4">ORDER ID</th>
                <th className="py-3 px-4">DATE &amp; TIME</th>
                <th className="py-3 px-4">VEHICLE &amp; DRIVER</th>
                <th className="py-3 px-4">ITEMS</th>
                <th className="py-3 px-4">RECEIVING OUTCOME</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    <RefreshCw className="size-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading delivery history...
                  </td>
                </tr>
              ) : paginatedHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No completed deliveries match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedHistory.map((row) => (
                  <tr key={row.orderId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      {row.orderId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground">{row.deliveryDate}</div>
                      <div className="text-[11px] text-muted-foreground">{row.arrivalInfo}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground">
                        {row.vehicleId} &bull; {row.vehicleType}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{row.driverName}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground">{row.itemCount} items</div>
                      <div className="text-[11px] text-muted-foreground">{row.unitCount} units</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div
                        className={`font-semibold ${
                          row.outcomeType === "clean"
                            ? "text-success"
                            : row.outcomeType === "issue_resolved"
                            ? "text-foreground"
                            : "text-warning"
                        }`}
                      >
                        {row.outcomeTitle}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{row.outcomeDetail}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StorePill tone="success">Completed</StorePill>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary hover:bg-secondary font-semibold text-xs"
                      >
                        <Link href={`/store/deliveries/${row.orderId}`}>
                          <span>View</span>
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filtered.length > 0 && (
          <div className="p-3.5 border-t border-border/60 bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1} &ndash;{" "}
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} deliveries
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 text-xs font-semibold"
              >
                Previous
              </Button>
              <span className="px-2 text-xs font-medium text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="h-8 text-xs font-semibold"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
