"use client";

import React, { useMemo, useState } from "react";
import { type Order } from "@/types/order";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
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

  // Eligible orders: Submitted or Confirmed, not allocated, and not late
  const eligibleOrders = useMemo(() => {
    return orders.filter(
      (o) =>
        (o.status === "CONFIRMED" || o.status === "SUBMITTED") &&
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
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Fresh</span>;
      case "style":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Style</span>;
      case "tech":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">Tech</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">{brand || "General"}</span>;
    }
  };

  const getTempBadge = (temp?: string) => {
    const isChilled = temp?.toLowerCase() === "chilled" || temp?.toLowerCase() === "reefer";
    if (isChilled) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap">
          <Snowflake className="size-3 text-sky-600" />
          Chilled
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
        <Package className="size-3 text-slate-500" />
        Ambient
      </span>
    );
  };

  const getStatusBadge = (order: Order) => {
    if (order.status === "DEFERRED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
          Deferred
        </span>
      );
    }
    if (order.status === "ALLOCATED" || order.allocation_id) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-[#18385F] border border-slate-300 whitespace-nowrap">
          <CheckCircle2 className="size-3 text-[#18385F]" />
          Allocated
        </span>
      );
    }
    if (order.is_priority) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap">
          <ShieldAlert className="size-3 text-orange-600" />
          Priority
        </span>
      );
    }
    if (order.status === "SUBMITTED") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
          Submitted
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">
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
      <div className="bg-white border border-[#E5E5E2] rounded-[10px] shadow-xs overflow-hidden flex flex-col">
        {/* Header bar of Table */}
        <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E5E2] bg-white">
          <div>
            <h2 className="text-[18px] font-bold text-[#171A1F] tracking-tight">Today&apos;s Order Queue</h2>
            <p className="text-[12px] text-[#6B7280] mt-0.5">
              Select eligible orders to allocate. Allocated or deferred orders cannot be selected.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {selectedOrderIds.length > 0 && (
              <span className="text-xs font-semibold text-[#18385F] bg-[#F6F6F3] border border-[#E5E5E2] px-3 py-1.5 rounded-md">
                {selectedOrderIds.length} {selectedOrderIds.length === 1 ? "order" : "orders"} selected
              </span>
            )}
            <Button
              onClick={onOpenAllocation}
              disabled={selectedOrderIds.length === 0}
              className="bg-[#18385F] hover:bg-[#122b49] text-white font-semibold text-xs h-10 px-5 rounded-[6px] transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
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
              <tr className="border-b border-[#E5E5E2] bg-[#F8F9FA] text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">
                  <Checkbox
                    checked={isAllEligibleSelected ? true : isSomeEligibleSelected ? "indeterminate" : false}
                    onCheckedChange={() => onToggleSelectAll(eligibleOrderIds)}
                    aria-label="Select all eligible orders"
                    disabled={eligibleOrderIds.length === 0}
                  />
                </th>
                <th className="py-3 px-4 w-28 whitespace-nowrap font-semibold text-[#171A1F]">Order</th>
                <th className="py-3 px-4 min-w-[200px] font-semibold text-[#171A1F]">Outlet</th>
                <th className="py-3 px-4 w-24 whitespace-nowrap font-semibold text-[#171A1F]">Brand</th>
                <th className="py-3 px-4 w-28 whitespace-nowrap font-semibold text-[#171A1F]">District</th>
                <th className="py-3 px-4 w-28 whitespace-nowrap font-semibold text-[#171A1F]">Temp</th>
                <th className="py-3 px-4 w-36 whitespace-nowrap font-semibold text-[#171A1F]">Window</th>
                <th className="py-3 px-4 w-24 whitespace-nowrap font-semibold text-[#171A1F] text-right">Load</th>
                <th className="py-3 px-4 w-28 whitespace-nowrap font-semibold text-[#171A1F]">Status</th>
                <th className="py-3 px-4 w-24 whitespace-nowrap font-semibold text-[#171A1F] text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E2] text-sm bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#6B7280] text-xs">
                    Loading orders queue...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#6B7280] text-xs">
                    No orders match the current filter criteria.
                  </td>
                </tr>
              ) : (
                orders.map((order) => {
                  const isEligible =
                    (order.status === "CONFIRMED" || order.status === "SUBMITTED") &&
                    !order.allocation_id &&
                    !order.is_late;
                  const isSelected = selectedOrderIds.includes(order.id);

                  return (
                    <tr
                      key={order.id}
                      className={`border-b border-[#E5E5E2] transition-colors ${
                        isSelected
                          ? "bg-[#F0FDF4]/70"
                          : isEligible
                          ? "hover:bg-slate-50/80 cursor-pointer"
                          : "bg-slate-50/40 opacity-75"
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
                      <td className="py-3.5 px-4 font-bold text-xs text-[#18385F] whitespace-nowrap">
                        {order.order_number}
                      </td>
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <div className="font-semibold text-xs text-[#171A1F]">{order.client_name}</div>
                        <div className="text-[11px] text-[#6B7280] line-clamp-1 mt-0.5">{order.destination_address}</div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{getBrandBadge(order.brand)}</td>
                      <td className="py-3.5 px-4 text-xs text-[#171A1F] font-semibold whitespace-nowrap">
                        {order.district || "—"}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{getTempBadge(order.temperature_zone)}</td>
                      <td className="py-3.5 px-4 font-mono text-xs text-[#6B7280] whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <Clock className="size-3 text-[#6B7280]" />
                          {order.delivery_window || "Standard"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-xs text-[#171A1F] whitespace-nowrap">
                        {order.weight_kg ? `${Math.round(order.weight_kg)} kg` : "—"}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">{getStatusBadge(order)}</td>
                      <td
                        className="py-3.5 px-4 text-right whitespace-nowrap pr-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isEligible ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeferralTarget(order)}
                            className="h-8 text-xs font-semibold text-[#6B7280] hover:text-amber-800 hover:bg-amber-50"
                          >
                            <Ban className="size-3 mr-1" />
                            Defer
                          </Button>
                        ) : order.deferral_reason ? (
                          <span className="text-xs text-amber-700 italic">
                            {order.deferral_reason}
                          </span>
                        ) : (
                          <span className="text-xs text-[#6B7280]">—</span>
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
