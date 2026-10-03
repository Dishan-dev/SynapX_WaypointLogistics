"use client";

import React, { useState, useEffect } from "react";
import { type Order, type OrderItem } from "@/types/order";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Package,
  Snowflake,
  Sun,
  Clock,
  MapPin,
  Calendar,
  Layers,
  X,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  FileSpreadsheet,
} from "lucide-react";
import { fetchWithFallback } from "@/lib/api";

interface OrderDetailDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onAllocate?: (order: Order) => void;
}

export function OrderDetailDrawer({
  order,
  isOpen,
  onClose,
  onAllocate,
}: OrderDetailDrawerProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Sync or fetch items when order changes
  useEffect(() => {
    if (!order || !isOpen) {
      setItems([]);
      return;
    }

    if (order.items && order.items.length > 0) {
      setItems(order.items);
      return;
    }

    // Fallback: Fetch order by ID if items weren't present in the list payload
    let ignore = false;
    async function fetchFullOrder() {
      setIsLoadingItems(true);
      try {
        const res = await fetchWithFallback(`/api/v1/orders/${order?.id}`);
        if (res.ok && !ignore) {
          const data: Order = await res.json();
          if (data.items) {
            setItems(data.items);
          }
        }
      } catch (err) {
        console.error("Failed to fetch order items:", err);
      } finally {
        if (!ignore) setIsLoadingItems(false);
      }
    }

    fetchFullOrder();

    return () => {
      ignore = true;
    };
  }, [order, isOpen]);

  if (!order) return null;

  const orderUnits =
    order.order_units ??
    order.units ??
    items.reduce((acc, it) => acc + (it.quantity || 0), 0);

  const orderWeight = order.order_weight_kg ?? order.weight_kg ?? 0;
  const orderVolume =
    order.order_volume_m3 ??
    order.volume_m3 ??
    (orderUnits > 0 ? Number((orderUnits * 0.02).toFixed(2)) : 0);

  const tempReq = (order.temp_requirement ?? order.temperature_zone ?? "Ambient").toLowerCase();
  const isChilled = tempReq.includes("chill") || tempReq.includes("reefer");

  const getBrandBadge = (brand?: string | null) => {
    switch (brand?.toLowerCase()) {
      case "fresh":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Fresh Chain
          </span>
        );
      case "style":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            Style Chain
          </span>
        );
      case "tech":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            Tech Chain
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {order.brand || "General"}
          </span>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "CONFIRMED":
      case "SUBMITTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
            {status}
          </span>
        );
      case "ALLOCATED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Allocated
          </span>
        );
      case "DEFERRED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Deferred
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const totalCalculatedAmount = items.reduce(
    (sum, item) => sum + (item.quantity * item.unit_price || 0),
    0
  );
  const displayTotal = order.total_amount > 0 ? order.total_amount : totalCalculatedAmount;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-[680px] w-full max-h-[90vh] flex flex-col p-0 rounded-[20px] bg-white border border-[#E5E5E2] shadow-2xl text-[#171A1F] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E5E2] bg-gradient-to-r from-slate-50 via-white to-slate-50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono text-lg font-bold text-[#18385F] tracking-tight">
                  {order.order_number}
                </span>
                {getBrandBadge(order.brand)}
                {getStatusBadge(order.status)}
                {order.is_priority && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    High Priority
                  </span>
                )}
              </div>
              <DialogTitle className="sr-only">Order Details for {order.order_number}</DialogTitle>
              <DialogDescription className="text-xs text-[#6B7280] mt-1 font-normal">
                Destination: <span className="font-semibold text-slate-800">{order.client_name}</span> · {order.destination_address}
              </DialogDescription>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-4 gap-2.5 mt-4 pt-3.5 border-t border-slate-200/70">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                Total Units
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Package className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-sm font-bold text-slate-800">
                  {orderUnits.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                Weight
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-sm font-bold text-slate-800">
                  {orderWeight.toLocaleString()} kg
                </span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                Volume
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-600" />
                <span className="text-sm font-bold text-slate-800">
                  {orderVolume.toFixed(2)} m³
                </span>
              </div>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
                Thermal Zone
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isChilled ? (
                  <>
                    <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                    <span className="text-sm font-bold text-sky-700">Chilled</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-sm font-bold text-slate-700">Ambient</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Body: Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Outlet & Delivery Logistics Info */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>Delivery Destination</span>
              </div>
              <p className="font-semibold text-slate-800 pl-5">
                {order.client_name}
              </p>
              <p className="text-slate-600 pl-5 text-[11px] leading-relaxed">
                {order.destination_address}
                {order.district ? ` (${order.district})` : ""}
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500 font-medium">
                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Fulfillment Window</span>
              </div>
              <p className="font-semibold text-slate-800 pl-5">
                {order.delivery_window || "Standard Logistics Window (08:00 - 16:00)"}
              </p>
              <p className="text-slate-600 pl-5 text-[11px] flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Date: {order.operating_date || "Current Operations"}</span>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#18385F]" />
                <h3 className="text-sm font-bold text-slate-800">
                  Order Line Items
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>

              {displayTotal > 0 && (
                <div className="text-xs text-slate-500 font-medium">
                  Total Value:{" "}
                  <span className="font-bold text-slate-800">
                    LKR {displayTotal.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3.5 w-12 text-center text-[11px]">#</th>
                    <th className="py-2.5 px-3.5 text-[11px]">SKU</th>
                    <th className="py-2.5 px-3.5 text-[11px]">Item Description</th>
                    <th className="py-2.5 px-3.5 text-right text-[11px]">Quantity</th>
                    <th className="py-2.5 px-3.5 text-right text-[11px]">Unit Price (LKR)</th>
                    <th className="py-2.5 px-3.5 text-right text-[11px]">Subtotal (LKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingItems ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        Loading order line items...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                        No individual line items registered for this order.
                      </td>
                    </tr>
                  ) : (
                    items.map((item, index) => {
                      const lineTotal = item.quantity * item.unit_price;
                      return (
                        <tr
                          key={item.id || `${item.sku}-${index}`}
                          className="hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[11px]">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-3.5 font-mono font-medium text-[#18385F] text-[11px] whitespace-nowrap">
                            {item.sku}
                          </td>
                          <td className="py-2.5 px-3.5 text-slate-800 font-medium">
                            {item.item_name}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-bold text-slate-800 whitespace-nowrap">
                            {item.quantity.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3.5 text-right text-slate-600 whitespace-nowrap">
                            {item.unit_price > 0
                              ? item.unit_price.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-semibold text-slate-900 whitespace-nowrap">
                            {lineTotal > 0
                              ? lineTotal.toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {items.length > 0 && (
                  <tfoot className="bg-slate-50 border-t border-slate-200">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3.5 font-semibold text-slate-700">
                        Total Sum
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-slate-900">
                        {items
                          .reduce((sum, it) => sum + (it.quantity || 0), 0)
                          .toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3.5 text-right text-slate-400 text-[11px]">
                        —
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-bold text-[#18385F]">
                        LKR{" "}
                        {displayTotal.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Allocation or Deferral Context Note if applicable */}
          {order.allocation_id && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Allocated to Delivery Run:</span> This order is assigned to Run ID #{order.allocation_id} and scheduled for dispatch loading.
              </div>
            </div>
          )}

          {order.deferral_reason && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Deferral Note:</span> {order.deferral_reason}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E5E2] bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Order ID: <span className="font-mono font-medium text-slate-700">#{order.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs border-slate-300 hover:bg-slate-100"
            >
              Close
            </Button>
            {onAllocate && (order.status === "CONFIRMED" || order.status === "SUBMITTED") && !order.allocation_id && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onAllocate(order);
                }}
                className="text-xs bg-[#18385F] hover:bg-[#142f50] text-white"
              >
                Allocate to Vehicle
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
