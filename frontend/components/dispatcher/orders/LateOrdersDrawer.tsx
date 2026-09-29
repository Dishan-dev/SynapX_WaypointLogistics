"use client";

import React, { useState } from "react";
import { type Order } from "@/types/order";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, Snowflake, Package, FastForward } from "lucide-react";
import { fetchWithFallback } from "@/lib/api";

interface LateOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  lateOrders: Order[];
  onOrderPromoted?: () => void;
}

export function LateOrdersDrawer({
  isOpen,
  onClose,
  lateOrders,
  onOrderPromoted,
}: LateOrdersDrawerProps) {
  const [promotingId, setPromotingId] = useState<number | null>(null);

  const handlePromoteOrder = async (orderId: number) => {
    setPromotingId(orderId);
    try {
      const res = await fetchWithFallback(`/api/v1/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_late: false,
          is_priority: true,
        }),
      });
      if (res.ok) {
        onOrderPromoted?.();
      }
    } catch (err) {
      console.error("Failed to promote order:", err);
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md md:max-w-xl p-0 flex flex-col h-full bg-card">
        {/* Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-amber-700" />
            <SheetTitle className="text-xl font-bold text-foreground">Queued Late Orders</SheetTitle>
          </div>
          <SheetDescription className="mt-1 text-xs text-muted-foreground">
            {lateOrders.length} orders received after the 4:00 PM cutoff window
          </SheetDescription>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Explanation Banner */}
          <div className="p-4 rounded-lg bg-[#FBF6EC] border border-[#E8DFD0] text-[#785422] flex items-start gap-3">
            <AlertCircle className="size-5 text-[#A37A3B] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold block text-[#5A3E17] text-sm mb-1">Planning Cutoff Notice</span>
              Order confirmation closed at 4:00 PM for today&apos;s active dispatch runs. These orders are currently queued for the next operating day (27 Sep 2026). You may promote emergency orders directly into today&apos;s active allocation queue as priority orders.
            </div>
          </div>

          {/* List */}
          <div className="space-y-3">
            {lateOrders.length === 0 ? (
              <div className="text-center py-10 text-xs text-muted-foreground">
                No late orders queued at this time.
              </div>
            ) : (
              lateOrders.map((order) => {
                const isChilled = order.temperature_zone?.toLowerCase() === "chilled";

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-lg border border-border bg-muted/20 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#18385F] dark:text-sky-400">
                          {order.order_number}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                          Next Day Queue
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs font-semibold text-foreground">
                          {Math.round(order.weight_kg)} kg
                        </span>
                      </div>

                      <div className="font-medium text-xs text-foreground mt-1">
                        {order.client_name}
                      </div>

                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                        <span>{order.district || "Colombo"}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          {isChilled ? (
                            <>
                              <Snowflake className="size-2.5 text-sky-600" />
                              Chilled
                            </>
                          ) : (
                            <>
                              <Package className="size-2.5 text-slate-500" />
                              Ambient
                            </>
                          )}
                        </span>
                        <span>·</span>
                        <span>{order.delivery_window || "08:00–10:00"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePromoteOrder(order.id)}
                        disabled={promotingId === order.id}
                        className="text-xs h-8 bg-card border-border hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300"
                      >
                        <FastForward className="size-3 mr-1" />
                        {promotingId === order.id ? "Promoting..." : "Rush Today"}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="p-4 border-t border-border bg-card">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs h-9 w-full sm:w-auto"
          >
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
