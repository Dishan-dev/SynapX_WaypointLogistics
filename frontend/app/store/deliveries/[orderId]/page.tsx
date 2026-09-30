"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Package,
  ThermometerSnowflake,
  Sun,
  ShieldCheck,
  User,
  Minus,
  Plus,
  Send,
  RefreshCw,
  WifiOff,
  Clock,
  FileCheck2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorePill } from "@/components/store/status-pill";
import { submitDeliveryReceipt, ReceiptCreatePayload } from "@/services/api";

interface LineItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  orderedUnits: number;
  receivedUnits: number;
  condition: "intact" | "damaged" | "short" | "wrong";
}

const mockOrderDetails = {
  orderNumber: "ORD0000002",
  brand: "Fresh",
  outletName: "Fresh Colombo (OUT005)",
  outletCode: "OUT005",
  deliveryWindow: "Today, 04:00 – 07:45",
  driverName: "Saman Kumara",
  driverPhone: "+94 71 987 6543",
  vehicleId: "VEH004",
  vehiclePlate: "WP-ND-3310",
  sealNumber: "SL-884019",
  tempLog: "+3.6°C (Cold Chain Intact)",
  tempRequirement: "chilled" as const,
  items: [
    {
      id: "item-1",
      sku: "SKU-99201",
      name: "Fresh Whole Milk 1L (Carton)",
      category: "Dairy Chilled",
      orderedUnits: 15,
      receivedUnits: 15,
      condition: "intact" as const,
    },
    {
      id: "item-2",
      sku: "SKU-99204",
      name: "Greek Style Yogurt 500g",
      category: "Dairy Chilled",
      orderedUnits: 10,
      receivedUnits: 10,
      condition: "intact" as const,
    },
    {
      id: "item-3",
      sku: "SKU-88301",
      name: "Farm Fresh Butter 250g",
      category: "Dairy Chilled",
      orderedUnits: 15,
      receivedUnits: 15,
      condition: "intact" as const,
    },
  ],
};

export default function DeliveryDetailsAndReceivingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;
  const router = useRouter();

  const [items, setItems] = useState<LineItem[]>(mockOrderDetails.items);
  const [sealVerified, setSealVerified] = useState(true);
  const [temperatureVerified, setTemperatureVerified] = useState(true);
  const [generalNotes, setGeneralNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("seal_broken");
  const [rejectNotes, setRejectNotes] = useState("");
  const [statusFeedback, setStatusFeedback] = useState<{
    success: boolean;
    isOffline?: boolean;
    message?: string;
  } | null>(null);

  const totalOrdered = items.reduce((acc, it) => acc + it.orderedUnits, 0);
  const totalReceived = items.reduce((acc, it) => acc + it.receivedUnits, 0);
  const hasShortfall = totalReceived < totalOrdered;
  const hasDamages = items.some((it) => it.condition === "damaged" || it.condition === "wrong");
  const hasIssues = hasShortfall || hasDamages || !sealVerified || !temperatureVerified;

  const handleUpdateUnits = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const newUnits = Math.max(0, item.receivedUnits + delta);
        let newCond = item.condition;
        if (newUnits < item.orderedUnits) newCond = "short";
        else if (newUnits === item.orderedUnits && item.condition === "short") newCond = "intact";
        return { ...item, receivedUnits: newUnits, condition: newCond };
      })
    );
  };

  const handleSetCondition = (id: string, cond: "intact" | "damaged" | "short" | "wrong") => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, condition: cond } : item))
    );
  };

  const handleConfirmReceipt = async () => {
    setIsSubmitting(true);
    const payload: ReceiptCreatePayload = {
      order_id: "a1b2c3d4-0000-0000-0000-000000000001",
      outlet_id: mockOrderDetails.outletCode,
      units_received: totalReceived,
      weight_received_kg: 80.0,
      has_issues: hasIssues,
      issue_type: hasIssues ? (hasDamages ? "damaged" : "short_delivery") : undefined,
      issue_description: hasIssues
        ? generalNotes || `Received ${totalReceived} of ${totalOrdered} units.`
        : undefined,
      confirmed_at: new Date().toISOString(),
    };

    try {
      const { isOffline } = await submitDeliveryReceipt(payload);
      if (isOffline) {
        setStatusFeedback({
          success: true,
          isOffline: true,
          message: "You are offline. Your delivery receipt has been saved locally and will sync on reconnect.",
        });
      } else {
        setStatusFeedback({
          success: true,
          isOffline: false,
          message: hasIssues
            ? "Receipt confirmed with discrepancy report filed to dispatch."
            : "Receipt confirmed successfully. Goods accepted into store inventory.",
        });
      }
      setTimeout(() => {
        router.push("/store/deliveries");
      }, 2500);
    } catch {
      setStatusFeedback({
        success: true,
        isOffline: true,
        message: "Receipt saved to offline storage.",
      });
      setTimeout(() => {
        router.push("/store/deliveries");
      }, 2500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const payload: ReceiptCreatePayload = {
      order_id: "a1b2c3d4-0000-0000-0000-000000000001",
      outlet_id: mockOrderDetails.outletCode,
      units_received: 0,
      has_issues: true,
      issue_type: "other",
      issue_description: `CONSIGNMENT REJECTED: Reason: ${rejectReason}. Notes: ${rejectNotes}`,
      confirmed_at: new Date().toISOString(),
    };

    try {
      await submitDeliveryReceipt(payload);
    } catch {
      // offline queue
    } finally {
      setIsSubmitting(false);
      setShowRejectModal(false);
      setStatusFeedback({
        success: true,
        message: "Delivery Rejected. Dispatcher and driver have been notified.",
      });
      setTimeout(() => {
        router.push("/store/deliveries");
      }, 2500);
    }
  };

  if (statusFeedback) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 text-center shadow-lg space-y-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            {statusFeedback.isOffline ? <WifiOff className="size-8" /> : <CheckCircle2 className="size-8" />}
          </div>
          <h2 className="text-xl font-bold text-foreground">{statusFeedback.isOffline ? "Saved Offline" : "Receipt Confirmed"}</h2>
          <p className="text-sm text-muted-foreground">{statusFeedback.message}</p>
          <p className="text-xs text-muted-foreground animate-pulse">Redirecting back to deliveries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-foreground/80 hover:text-primary">
          <Link href="/store/deliveries">
            <ArrowLeft className="size-4" />
            <span>Back to Deliveries</span>
          </Link>
        </Button>
        <span className="text-xs font-mono font-medium text-muted-foreground">
          {mockOrderDetails.orderNumber} &bull; {mockOrderDetails.outletCode}
        </span>
      </div>

      {/* Main Delivery Title Card */}
      <div className="bg-card border border-border rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-primary">
              Delivery Details &amp; Receiving
            </div>
            <h1 className="text-2xl font-bold text-foreground mt-1">
              {mockOrderDetails.orderNumber}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Target Outlet: <strong className="text-foreground">{mockOrderDetails.outletName}</strong> &bull; Window: {mockOrderDetails.deliveryWindow}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StorePill tone="warning">At Dock (Awaiting Signoff)</StorePill>
          </div>
        </div>

        {/* Vehicle, Driver & Cold-Chain Specs Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/60 text-xs">
          <div className="p-3 bg-muted/60 rounded-lg space-y-1">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Driver &amp; Vehicle</div>
            <div className="font-bold text-foreground">{mockOrderDetails.driverName}</div>
            <div className="text-muted-foreground">{mockOrderDetails.vehiclePlate} ({mockOrderDetails.vehicleId})</div>
          </div>

          <div className="p-3 bg-muted/60 rounded-lg space-y-1">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Container Seal #</div>
            <div className="font-mono font-bold text-foreground">{mockOrderDetails.sealNumber}</div>
            <label className="flex items-center gap-1.5 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={sealVerified}
                onChange={(e) => setSealVerified(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className={sealVerified ? "text-success font-semibold" : "text-destructive font-semibold"}>
                {sealVerified ? "Seal Intact & Matched" : "Seal Broken / Mismatched"}
              </span>
            </label>
          </div>

          <div className="p-3 bg-muted/60 rounded-lg space-y-1">
            <div className="text-[10px] uppercase font-bold text-muted-foreground">Temperature Log</div>
            <div className="font-bold text-success">{mockOrderDetails.tempLog}</div>
            <label className="flex items-center gap-1.5 cursor-pointer pt-0.5">
              <input
                type="checkbox"
                checked={temperatureVerified}
                onChange={(e) => setTemperatureVerified(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className={temperatureVerified ? "text-success font-semibold" : "text-destructive font-semibold"}>
                {temperatureVerified ? "Cold-Chain Compliant" : "Temp Exceeded Limits"}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Item-by-item Receiving Verification Table */}
      <section className="bg-card border border-border rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Items Receiving Checklist</h2>
            <p className="text-xs text-muted-foreground">
              Verify quantities unloaded from the truck container and check carton conditions.
            </p>
          </div>
          <div className="text-xs font-bold">
            Total: <span className={hasShortfall ? "text-warning" : "text-foreground"}>{totalReceived}</span> / {totalOrdered} units
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            return (
              <div
                key={item.id}
                className="p-4 rounded-lg border border-border bg-background/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{item.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                      {item.sku}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Category: {item.category} &bull; Ordered: <strong className="text-foreground">{item.orderedUnits} units</strong>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  {/* Condition selector buttons */}
                  <div className="flex items-center gap-1 text-xs">
                    {(["intact", "damaged", "wrong"] as const).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => handleSetCondition(item.id, cond)}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                          item.condition === cond
                            ? cond === "intact"
                              ? "bg-success text-success-foreground"
                              : "bg-warning text-warning-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {cond === "intact" ? "Intact" : cond === "damaged" ? "Damaged" : "Wrong Item"}
                      </button>
                    ))}
                  </div>

                  {/* Units stepper */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateUnits(item.id, -1)}
                      className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center font-bold text-sm cursor-pointer"
                    >
                      <Minus className="size-4" />
                    </button>
                    <span className="w-8 text-center font-bold text-sm text-foreground">
                      {item.receivedUnits}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateUnits(item.id, 1)}
                      className="w-8 h-8 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center font-bold text-sm cursor-pointer"
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* General Receiving Remarks */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-bold uppercase text-muted-foreground">
            Receiving Remarks / Discrepancy Notes
          </label>
          <textarea
            rows={2}
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            placeholder="Add any additional remarks regarding delivery timing, driver assistance, or packaging condition..."
            className="w-full text-xs p-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      </section>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowRejectModal(true)}
          className="w-full sm:w-auto text-destructive border-destructive/40 hover:bg-destructive-muted hover:text-destructive font-semibold"
        >
          <XCircle className="size-4 mr-1.5" />
          <span>Reject Consignment</span>
        </Button>

        <Button
          type="button"
          onClick={handleConfirmReceipt}
          disabled={isSubmitting}
          className="w-full sm:w-auto min-w-[220px] bg-primary text-primary-foreground font-bold hover:bg-primary/90"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="size-4 animate-spin mr-2" />
              <span>Submitting Receipt...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4 mr-2" />
              <span>{hasIssues ? "Confirm with Discrepancies" : "Confirm Delivery Receipt"}</span>
            </>
          )}
        </Button>
      </div>

      {/* Reject Delivery Modal (Figma 06b Reject Delivery Sheet) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 space-y-5 shadow-xl">
            <div className="flex items-center gap-3 text-destructive">
              <div className="w-10 h-10 rounded-lg bg-destructive-muted flex items-center justify-center shrink-0">
                <AlertTriangle className="size-6 text-destructive" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Reject Consignment</h3>
                <p className="text-xs text-muted-foreground">Order {mockOrderDetails.orderNumber}</p>
              </div>
            </div>

            <form onSubmit={handleRejectDelivery} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Rejection Reason</label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none"
                >
                  <option value="seal_broken">Security Seal Broken / Missing</option>
                  <option value="temp_breach">Temperature / Cold Chain Breach</option>
                  <option value="major_damage">Extensive Goods Damage in Transit</option>
                  <option value="wrong_destination">Wrong Store Consignment</option>
                  <option value="other">Other Severe Issue</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-muted-foreground">Rejection Notes *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Describe why the vehicle was turned away..."
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-background focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || rejectNotes.trim().length < 5} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold">
                  Confirm Rejection
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
