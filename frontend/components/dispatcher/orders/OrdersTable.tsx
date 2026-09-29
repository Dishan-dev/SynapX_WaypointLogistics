"use client";

import React, { useMemo, useState } from "react";
import { type Order } from "@/types/order";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Snowflake, Package, Clock, ShieldAlert, ArrowRight, Ban, CheckCircle2 } from "lucide-react";
import { RepeatDeferralModal } from "./RepeatDeferralModal";

interface OrdersTableProps {
  orders: Order[];
  selectedOrderIds: number[];
  onToggleSelectOrder: (orderId: number) => void;
  onToggleSelectAll: (eligibleOrderIds: number[]) => void;
  onOpenAllocation: () => void;
  onDeferOrder: (order: Order, reason?: string) => Promise<void> | void;
  isLoading?: boolean;
}

export function OrdersTable({
  orders,
  selectedOrderIds,
  onToggleSelectOrder,
  onToggleSelectAll,
  onOpenAllocation,
  onDeferOrder,
  isLoading,
}: OrdersTableProps) {
  const [deferralTarget, setDeferralTarget] = useState<Order | null>(null);
  const [isDeferring, setIsDeferring] = useState(false);

  // Eligible orders: Confirmed, not allocated, and not late
  const eligibleOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        o.status === "CONFIRMED" &&
        !o.allocation_id &&
        !o.is_late
    );
  }, [orders]);

  const eligibleOrderIds = useMemo(() => eligibleOrders.map((o) => o.id), [eligibleOrders]);

  const isAllEligibleSelected =
    eligibleOrderIds.length > 0 &&
    eligibleOrderIds.every((id) => selectedOrderIds.includes(id));

  const isSomeEligibleSelected =
    eligibleOrderIds.some((id) => selectedOrderIds.includes(id)) && !isAllEligibleSelected;

  const getBrandBadge = (brand?: string | null) => {
    switch (brand?.toLowerCase()) {
      case "fresh":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Fresh</span>;
      case "style":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">Style</span>;
      case "tech":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">Tech</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{brand || "General"}</span>;
    }
  };

  const getTempBadge = (temp?: string) => {
    const isChilled = temp?.toLowerCase() === "chilled" || temp?.toLowerCase() === "reefer";
    if (isChilled) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
          <Snowflake className="size-3 text-sky-600" />
          Chilled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
        <Package className="size-3 text-slate-500" />
        Ambient
      </span>
    );
  };

  const getStatusBadge = (order: Order) => {
    if (order.status === "DEFERRED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
          Deferred
        </span>
      );
    }
    if (order.status === "ALLOCATED" || order.allocation_id) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-[#18385F] border border-slate-300">
          <CheckCircle2 className="size-3 text-[#18385F]" />
          Allocated
        </span>
      );
    }
    if (order.is_priority) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
          <ShieldAlert className="size-3 text-orange-600" />
          Priority
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        Confirmed
      </span>
    );
  };

  const handleConfirmDeferral = async (reason: string) => {
    if (!deferralTarget) return;
    setIsDeferring(true);
    try {
      await onDeferOrder(deferralTarget, reason);
      setDeferralTarget(null);
    } finally {
      setIsDeferring(false);
    }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col">
        {/* Header bar of Table */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border bg-card">
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">Today&apos;s Order Queue</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select eligible orders to allocate. Allocated or deferred orders cannot be selected.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedOrderIds.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                {selectedOrderIds.length} {selectedOrderIds.length === 1 ? "order" : "orders"} selected
              </span>
            )}
            <Button
              onClick={onOpenAllocation}
              disabled={selectedOrderIds.length === 0}
              className="bg-[#18385F] hover:bg-[#122b49] text-white font-medium text-xs h-9 px-4 rounded-md transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Allocate Vehicle {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : ""}
              <ArrowRight className="size-3.5 ml-1.5" />
            </Button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
                <th className="py-3 px-4 w-12 text-center">
                  <Checkbox
                    checked={isAllEligibleSelected ? true : isSomeEligibleSelected ? "indeterminate" : false}
                    onCheckedChange={() => onToggleSelectAll(eligibleOrderIds)}
                    aria-label="Select all eligible orders"
                    disabled={eligibleOrderIds.length === 0}
                  />
                </th>
                <th className="py-3 px-4 font-semibold text-foreground">Order</th>
                <th className="py-3 px-4 font-semibold text-foreground">Outlet</th>
                <th className="py-3 px-4 font-semibold text-foreground">Brand</th>
                <th className="py-3 px-4 font-semibold text-foreground">District</th>
                <th className="py-3 px-4 font-semibold text-foreground">Temp</th>
                <th className="py-3 px-4 font-semibold text-foreground">Window</th>
                <th className="py-3 px-4 font-semibold text-foreground text-right">Load</th>
                <th className="py-3 px-4 font-semibold text-foreground">Status</th>
                <th className="py-3 px-4 font-semibold text-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground text-xs">
                    Loading orders queue...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground text-xs">
                    No orders match the current filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const isEligible = order.status === "CONFIRMED" && !order.allocation_id && !order.is_late;
                  const isSelected = selectedOrderIds.includes(order.id);

                  return (
                    <tr
                      key={order.id}
                      className={`transition-colors ${
                        isSelected
                          ? "bg-sky-50/60 dark:bg-sky-950/20"
                          : isEligible
                          ? "hover:bg-muted/40 cursor-pointer"
                          : "bg-muted/20 opacity-80"
                      }`}
                      onClick={() => {
                        if (isEligible) {
                          onToggleSelectOrder(order.id);
                        }
                      }}
                    >
                      <td
                        className="py-3.5 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEligible ? (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggleSelectOrder(order.id)}
                            aria-label={`Select ${order.order_number}`}
                          />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Checkbox checked={false} disabled aria-label="Not eligible for selection" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs">
                                {order.status === "ALLOCATED" || order.allocation_id
                                  ? "Already allocated to a vehicle run"
                                  : order.status === "DEFERRED"
                                  ? "Order is deferred"
                                  : "Order queued for next day"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#18385F] dark:text-sky-400">
                        {order.order_number}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">{order.client_name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{order.destination_address}</div>
                      </td>
                      <td className="py-3.5 px-4">{getBrandBadge(order.brand)}</td>
                      <td className="py-3.5 px-4 text-foreground font-medium">{order.district || "—"}</td>
                      <td className="py-3.5 px-4">{getTempBadge(order.temperature_zone)}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        <div className="inline-flex items-center gap-1">
                          <Clock className="size-3 text-muted-foreground" />
                          {order.delivery_window || "Standard"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-foreground">
                        {order.weight_kg ? `${Math.round(order.weight_kg)} kg` : "—"}
                      </td>
                      <td className="py-3.5 px-4">{getStatusBadge(order)}</td>
                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEligible ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeferralTarget(order)}
                            className="h-8 text-xs text-muted-foreground hover:text-amber-700 hover:bg-amber-50"
                          >
                            <Ban className="size-3 mr-1" />
                            Defer
                          </Button>
                        ) : order.deferral_reason ? (
                          <span className="text-xs text-amber-700 dark:text-amber-400 italic">
                            {order.deferral_reason}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Repeat Deferral Warning Modal (Figma Frame 229:2532) */}
      <RepeatDeferralModal
        isOpen={!!deferralTarget}
        onClose={() => setDeferralTarget(null)}
        onConfirm={handleConfirmDeferral}
        order={deferralTarget}
        isSubmitting={isDeferring}
      />
    </>
  );
}
