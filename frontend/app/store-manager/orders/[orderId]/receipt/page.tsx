"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Package,
  Weight,
  Layers,
  ThermometerSnowflake,
  Sun,
  Send,
  RefreshCw,
  WifiOff,
  Clock,
  Building2,
  FileCheck2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StorePill } from "@/components/store/status-pill";
import {
  submitDeliveryReceipt,
  getDeliveryReceipt,
  DeliveryReceipt,
  ReceiptCreatePayload,
} from "@/services/api";
import { getStoreOrder } from "@/components/store/api/store-data";
import { STORE_OUTLET_ID } from "@/components/store/api/config";
import { StoreOrder } from "@/components/store/mock-data";

export default function ReceiptConfirmationPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;
  const router = useRouter();

  const [order, setOrder] = useState<StoreOrder | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<DeliveryReceipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasIssue, setHasIssue] = useState<boolean>(false);
  const [issueType, setIssueType] = useState<string>("short_delivery");
  const [issueDescription, setIssueDescription] = useState<string>("");
  const [unitsReceived, setUnitsReceived] = useState<number>(40);
  const [weightReceived, setWeightReceived] = useState<number>(120.5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    isOffline?: boolean;
    message?: string;
  } | null>(null);

  // Order summary derived from real fetched order or sensible defaults
  const totalUnits = order?.items.reduce((sum, it) => sum + (it.quantitySent ?? it.quantity), 0) ?? 40;
  const orderSummary = {
    id: order?.id ?? (parseInt(orderId.replace(/\D/g, ""), 10) || 1),
    orderNumber: order?.orderNumber ?? orderId,
    outlet_id: STORE_OUTLET_ID,
    outlet_name: "Colombo Fresh - Pettah",
    brand: order?.temperatureClass === "chilled" ? "Fresh (Chilled)" : "Fresh",
    expected_units: totalUnits,
    expected_weight_kg: 120.5,
    temp_requirement: order?.temperatureClass ?? "chilled",
    delivered_at: "Today, 07:15 AM",
  };

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [receipt, orderData] = await Promise.all([
          getDeliveryReceipt(orderId),
          getStoreOrder(orderId),
        ]);
        if (receipt) {
          setExistingReceipt(receipt);
        }
        if (orderData) {
          setOrder(orderData);
          const total = orderData.items.reduce((sum, it) => sum + (it.quantitySent ?? it.quantity), 0);
          if (total > 0) {
            setUnitsReceived(total);
          }
        }
      } catch {
        // Handled gracefully
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [orderId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasIssue && issueDescription.trim().length < 10) return;

    setIsSubmitting(true);
    const payload: ReceiptCreatePayload = {
      order_id: orderSummary.id,
      outlet_id: orderSummary.outlet_id,
      units_received: unitsReceived,
      weight_received_kg: weightReceived,
      has_issues: hasIssue,
      issue_type: hasIssue ? issueType : undefined,
      issue_description: hasIssue ? issueDescription.trim() : undefined,
      confirmed_at: new Date().toISOString(),
    };

    try {
      const { isOffline } = await submitDeliveryReceipt(payload);
      if (isOffline) {
        setSubmitResult({
          success: true,
          isOffline: true,
          message: "You're offline. Your receipt has been saved and will sync automatically when you reconnect.",
        });
      } else {
        setSubmitResult({
          success: true,
          isOffline: false,
          message: hasIssue
            ? "Receipt and issue report submitted. Central dispatch has been notified."
            : "Receipt confirmed. Thank you!",
        });
      }

      setTimeout(() => {
        router.push("/store/deliveries");
      }, 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      setSubmitResult({
        success: false,
        message: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <RefreshCw className="size-8 animate-spin mx-auto text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Checking delivery status...</p>
        </div>
      </div>
    );
  }

  // If already confirmed
  if (existingReceipt) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 text-center shadow-lg space-y-5">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <FileCheck2 className="size-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Receipt Already Confirmed
            </h1>
            <p className="text-sm text-muted-foreground">
              Delivery for order <strong className="text-foreground">{orderSummary.orderNumber}</strong> was previously confirmed on{" "}
              {existingReceipt.confirmed_at ? new Date(existingReceipt.confirmed_at).toLocaleDateString() : "today"}.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs text-left space-y-1 text-muted-foreground">
            <div><strong className="text-foreground">Units Received:</strong> {existingReceipt.units_received ?? "All"}</div>
            <div><strong className="text-foreground">Issues Flagged:</strong> {existingReceipt.has_issues ? existingReceipt.issue_type : "None (All Good)"}</div>
          </div>
          <Button
            asChild
            className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/90 h-11"
          >
            <Link href="/store/deliveries">
              <span>Back to Deliveries</span>
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // If result submitted
  if (submitResult && submitResult.success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 sm:p-8 text-center shadow-lg space-y-6">
          <div
            className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center ${
              submitResult.isOffline
                ? "bg-warning/10 text-warning"
                : "bg-success/10 text-success"
            }`}
          >
            {submitResult.isOffline ? <WifiOff className="size-10" /> : <CheckCircle2 className="size-10" />}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {submitResult.isOffline ? "Saved Offline" : "Receipt Confirmed"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {submitResult.message}
            </p>
          </div>

          <div className="text-xs text-muted-foreground animate-pulse">
            Redirecting to deliveries in a moment...
          </div>
        </div>
      </div>
    );
  }

  const isFormValid = !hasIssue || issueDescription.trim().length >= 10;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/store/deliveries">
            <ArrowLeft className="size-4" />
            <span>Back to Deliveries</span>
          </Link>
        </Button>
        <span className="text-xs font-mono font-medium text-muted-foreground">
          Order: {orderSummary.orderNumber}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Confirm Delivery Receipt
            </h1>
            <StorePill tone="brand">Fresh</StorePill>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Verify the goods delivered to <strong className="text-foreground">{orderSummary.outlet_name}</strong> and sign off or report discrepancies.
          </p>
        </div>

        {/* Ordered vs Delivered Specs Card */}
        <section className="bg-card border border-border rounded-xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <span className="text-sm font-bold text-foreground">
                {orderSummary.outlet_name} ({orderSummary.outlet_id})
              </span>
            </div>
            <StorePill tone="info">{orderSummary.brand}</StorePill>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 bg-muted/40 rounded-xl border border-border/50">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Ordered Units</div>
              <div className="text-lg font-bold text-foreground mt-0.5">
                {orderSummary.expected_units}
              </div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border/50">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Ordered Weight</div>
              <div className="text-lg font-bold text-foreground mt-0.5">
                {orderSummary.expected_weight_kg} kg
              </div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl border border-border/50">
              <div className="text-[10px] uppercase font-bold text-muted-foreground">Delivered At</div>
              <div className="text-xs sm:text-sm font-bold text-foreground mt-1">
                {orderSummary.delivered_at}
              </div>
            </div>
          </div>
        </section>

        {/* Primary Selection: All Good vs Report Issue */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => {
              setHasIssue(false);
              setUnitsReceived(orderSummary.expected_units);
            }}
            className={`p-5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-xs ${
              !hasIssue
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-card hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-success-muted text-success-muted-foreground flex items-center justify-center">
                <CheckCircle2 className="size-6 text-success" />
              </div>
              {!hasIssue && (
                <StorePill tone="success">Selected</StorePill>
              )}
            </div>
            <div>
              <div className="text-base font-bold text-foreground">
                All Received Correctly
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Full quantity arrived intact with proper temperature control and zero defects.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setHasIssue(true)}
            className={`p-5 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-xs ${
              hasIssue
                ? "border-warning bg-warning-muted/30 ring-2 ring-warning/20"
                : "border-border bg-card hover:border-border/80"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-warning-muted text-warning-muted-foreground flex items-center justify-center">
                <AlertTriangle className="size-6 text-warning" />
              </div>
              {hasIssue && (
                <StorePill tone="warning">Selected</StorePill>
              )}
            </div>
            <div>
              <div className="text-base font-bold text-foreground">
                Report an Issue
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Missing units, damaged goods, wrong items, or seal tampering identified.
              </p>
            </div>
          </button>
        </div>

        {/* Simple Units Received (If All Received) */}
        {!hasIssue && (
          <div className="bg-card border border-border rounded-xl p-5 shadow-xs flex items-center justify-between gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Confirmed Units Received
              </label>
              <p className="text-xs text-muted-foreground">Matches ordered quantity</p>
            </div>
            <input
              type="number"
              min="0"
              value={unitsReceived}
              onChange={(e) => setUnitsReceived(parseInt(e.target.value, 10) || 0)}
              className="w-28 text-center text-xl font-bold py-2 rounded-xl border border-border bg-background text-foreground"
            />
          </div>
        )}

        {/* Detailed Issue Form (If Report an Issue Selected) */}
        {hasIssue && (
          <section className="bg-card border border-warning/50 rounded-xl p-5 sm:p-6 shadow-xs space-y-5">
            <div className="text-xs font-bold uppercase tracking-wider text-warning">
              Issue Details &amp; Discrepancy Log
            </div>

            {/* Issue Type Radio Cards */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase text-muted-foreground">
                Issue Classification <span className="text-destructive">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "short_delivery", label: "Short Delivery" },
                  { id: "damaged", label: "Damaged Goods" },
                  { id: "wrong_items", label: "Wrong Items" },
                  { id: "other", label: "Other" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setIssueType(t.id)}
                    className={`p-3 rounded-lg border text-xs font-bold text-center transition-all cursor-pointer ${
                      issueType === t.id
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-muted/40 border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actual Units Received Field */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-muted-foreground">
                  Actual Units Received <span className="text-destructive">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={unitsReceived}
                  onChange={(e) => setUnitsReceived(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-base font-bold p-3 rounded-lg border border-border bg-background text-foreground"
                />
                <span className="text-[11px] text-muted-foreground">
                  Expected: {orderSummary.expected_units} units
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase text-muted-foreground">
                  Actual Weight Received (kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={weightReceived}
                  onChange={(e) => setWeightReceived(parseFloat(e.target.value) || 0)}
                  className="w-full text-base font-bold p-3 rounded-lg border border-border bg-background text-foreground"
                />
              </div>
            </div>

            {/* Issue Description Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase text-muted-foreground">
                Issue Description / Remarks <span className="text-destructive">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={issueDescription}
                onChange={(e) => setIssueDescription(e.target.value)}
                placeholder="Provide details about the damage, missing cartons, or batch mismatches..."
                className="w-full text-xs p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Min 10 characters</span>
                <span className={issueDescription.length < 10 ? "text-warning font-semibold" : "text-success"}>
                  {issueDescription.length} characters
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="w-full min-h-[48px] bg-primary text-primary-foreground font-bold hover:bg-primary/90 text-sm gap-2"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              <span>Submitting Receipt...</span>
            </>
          ) : hasIssue ? (
            <>
              <Send className="size-4" />
              <span>Submit Discrepancy &amp; Confirm Receipt</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" />
              <span>Confirm Delivery Receipt</span>
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
