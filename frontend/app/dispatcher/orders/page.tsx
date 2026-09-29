"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { type Order, type OrderMetrics } from "@/types/order";
import { OrdersTable } from "@/components/dispatcher/orders/OrdersTable";
import { OrdersFilterBar } from "@/components/dispatcher/orders/OrdersFilterBar";
import { QuickAllocationDrawer } from "@/components/dispatcher/orders/QuickAllocationDrawer";
import { LateOrdersDrawer } from "@/components/dispatcher/orders/LateOrdersDrawer";
import { CapacityShortfallModal } from "@/components/dispatcher/orders/CapacityShortfallModal";
import { AllocationSuccessBanner } from "@/components/dispatcher/orders/AllocationSuccessBanner";
import { MetricCard } from "@/components/dispatcher/MetricCard";
import { Button } from "@/components/ui/button";
import { AlertCircle, Clock, RefreshCw } from "lucide-react";
import { fetchWithFallback } from "@/lib/api";

export default function DispatcherOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<OrderMetrics>({
    total_orders: 0,
    confirmed: 0,
    unallocated: 0,
    allocated: 0,
    deferred: 0,
    priority: 0,
    late: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // Drawers and Modals
  const [isAllocationOpen, setIsAllocationOpen] = useState(false);
  const [isLateOrdersOpen, setIsLateOrdersOpen] = useState(false);
  const [isCapacityShortfallOpen, setIsCapacityShortfallOpen] = useState(false);

  // Success Banner
  const [successBanner, setSuccessBanner] = useState<{
    vehicleCode: string;
    count: number;
  } | null>(null);

  // Selection
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("27 Jun 2026");

  // Fetch orders and metrics
  const fetchOrdersAndMetrics = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch metrics
      const metricsRes = await fetchWithFallback("/api/v1/orders/metrics");
      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
      }

      // 2. Fetch orders
      const queryParams = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") queryParams.append("status", statusFilter);
      if (brandFilter && brandFilter !== "all") queryParams.append("brand", brandFilter);
      if (districtFilter && districtFilter !== "all") queryParams.append("district", districtFilter);
      if (searchQuery.trim()) queryParams.append("search", searchQuery.trim());
      // Show non-late orders in main queue table by default
      queryParams.append("is_late", "false");

      const ordersRes = await fetchWithFallback(`/api/v1/orders/?${queryParams.toString()}`);
      if (ordersRes.ok) {
        const oData: Order[] = await ordersRes.json();
        setOrders(oData);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, brandFilter, districtFilter, searchQuery]);

  useEffect(() => {
    fetchOrdersAndMetrics();
  }, [fetchOrdersAndMetrics]);

  // Late orders (fetched separately for late drawer)
  const [lateOrders, setLateOrders] = useState<Order[]>([]);
  const fetchLateOrders = useCallback(async () => {
    try {
      const res = await fetchWithFallback("/api/v1/orders/?is_late=true");
      if (res.ok) {
        const data = await res.json();
        setLateOrders(data);
      }
    } catch (err) {
      console.error("Failed to load late orders:", err);
    }
  }, []);

  useEffect(() => {
    fetchLateOrders();
  }, [fetchLateOrders]);

  // Selected orders array
  const selectedOrders = useMemo(() => {
    return orders.filter((o) => selectedOrderIds.includes(o.id));
  }, [orders, selectedOrderIds]);

  // Selection handlers
  const handleToggleSelectOrder = (orderId: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleToggleSelectAll = (eligibleOrderIds: number[]) => {
    const isAllSelected = eligibleOrderIds.every((id) => selectedOrderIds.includes(id));
    if (isAllSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !eligibleOrderIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...eligibleOrderIds])));
    }
  };

  const handleDeferOrder = async (order: Order, reason?: string) => {
    try {
      const res = await fetchWithFallback(`/api/v1/orders/${order.id}/defer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || "Capacity limitation" }),
      });
      if (res.ok) {
        setSelectedOrderIds((prev) => prev.filter((id) => id !== order.id));
        fetchOrdersAndMetrics();
      }
    } catch (err) {
      console.error("Failed to defer order:", err);
    }
  };

  const handleAllocationSuccess = (vehicleCode: string, count: number) => {
    setSelectedOrderIds([]);
    setSuccessBanner({ vehicleCode, count });
    fetchOrdersAndMetrics();
  };

  return (
    <div className="space-y-6 relative">
      {/* Allocation Success Toast matching Figma frame 30:672 */}
      {successBanner && (
        <AllocationSuccessBanner
          allocatedCount={successBanner.count}
          vehicleCode={successBanner.vehicleCode}
          onDismiss={() => setSuccessBanner(null)}
        />
      )}

      {/* 01 Header & Alerts */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#171A1F] dark:text-foreground">
            Orders
          </h1>
          <p className="text-sm text-[#6B7280] dark:text-muted-foreground mt-1">
            Manage the order queue by operating date, status, and allocation readiness.
          </p>
        </div>

        {/* Action Triggers: Late Orders & Capacity Shortfall Warning */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Capacity Shortfall Warning matching Figma frame 229:2309 */}
          <div className="flex items-center justify-between gap-3 p-3 px-3.5 rounded-lg bg-[#FDF2F2] border border-[#FEE2E2] shadow-xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#DC2626] shrink-0" />
              <div className="text-xs font-semibold text-[#171A1F]">Capacity Shortfall</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsCapacityShortfallOpen(true)}
              className="text-xs h-7 bg-white border-[#FEE2E2] text-[#DC2626] hover:bg-[#FDF2F2] font-semibold shrink-0"
            >
              Review Shortfall
            </Button>
          </div>

          {/* Late Orders Trigger Card matching Figma frame 148:1331 */}
          <div className="flex items-center justify-between gap-3 p-3 px-3.5 rounded-lg bg-[#FBF6EC] border border-[#EBE3D3] shadow-xs">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#A37A3B] shrink-0" />
              <div className="text-xs font-semibold text-[#171A1F]">
                4:00 PM Cutoff · {lateOrders.length} Late
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsLateOrdersOpen(true)}
              className="text-xs h-7 bg-white border-[#EBE3D3] text-[#18385F] hover:bg-[#FBF6EC] font-semibold shrink-0"
            >
              View Late Orders
            </Button>
          </div>
        </div>
      </div>

      {/* 02 Filters & Actions */}
      <OrdersFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        brandFilter={brandFilter}
        onBrandChange={setBrandFilter}
        districtFilter={districtFilter}
        onDistrictChange={setDistrictFilter}
        dateFilter={dateFilter}
        onDateChange={setDateFilter}
      />

      {/* 03 Summary Metrics Cards matching Figma 03 Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Orders"
          value={metrics.total_orders}
          className="border-border bg-card"
        />
        <MetricCard
          title="Unallocated"
          value={metrics.unallocated}
          className="border-border bg-card text-[#18385F]"
        />
        <MetricCard
          title="Allocated"
          value={metrics.allocated}
          className="border-border bg-card text-[#166534]"
        />
        <MetricCard
          title="Deferred"
          value={metrics.deferred}
          className="border-border bg-card text-amber-700"
        />
      </div>

      {/* 04 Main Orders Queue Table matching Figma 04 Main Workspace */}
      <OrdersTable
        orders={orders}
        selectedOrderIds={selectedOrderIds}
        onToggleSelectOrder={handleToggleSelectOrder}
        onToggleSelectAll={handleToggleSelectAll}
        onOpenAllocation={() => setIsAllocationOpen(true)}
        onDeferOrder={handleDeferOrder}
        isLoading={isLoading}
      />

      {/* Quick Allocation Sheet Drawer with Constraint Review (Figma Frames 9:370 & 163:2021) */}
      <QuickAllocationDrawer
        isOpen={isAllocationOpen}
        onClose={() => setIsAllocationOpen(false)}
        selectedOrders={selectedOrders}
        onAllocationSuccess={handleAllocationSuccess}
      />

      {/* Queued Late Orders Drawer (Figma Frame 148:1331) */}
      <LateOrdersDrawer
        isOpen={isLateOrdersOpen}
        onClose={() => setIsLateOrdersOpen(false)}
        lateOrders={lateOrders}
        onOrderPromoted={() => {
          fetchLateOrders();
          fetchOrdersAndMetrics();
        }}
      />

      {/* Capacity Shortfall Warning Modal (Figma Frame 229:2309) */}
      <CapacityShortfallModal
        isOpen={isCapacityShortfallOpen}
        onClose={() => setIsCapacityShortfallOpen(false)}
      />
    </div>
  );
}
