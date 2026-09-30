import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import type { OrderStatus, StoreOrder } from "@/components/store/mock-data";

// Store Manager status pill (Figma: Components / Status Pill). Always shows a text label,
// so status is never communicated by colour alone.
const storePillVariants = cva("h-auto rounded-xl border-transparent px-2 py-0.5 text-sm font-medium", {
  variants: {
    tone: {
      neutral: "bg-muted text-foreground",
      brand: "bg-accent text-accent-foreground",
      info: "bg-info-muted text-info-muted-foreground",
      success: "bg-success-muted text-success-muted-foreground",
      warning: "bg-warning-muted text-warning-muted-foreground",
      destructive: "bg-destructive-muted text-destructive-muted-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type StorePillTone = NonNullable<VariantProps<typeof storePillVariants>["tone"]>;

export function StorePill({
  tone,
  className,
  children,
}: {
  tone?: StorePillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return <Badge className={cn(storePillVariants({ tone }), className)}>{children}</Badge>;
}

// Labels follow the Figma progress steps (docs/store-manager-contract.md §1).
const orderStatusDisplay: Record<OrderStatus, { label: string; tone: StorePillTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "brand" },
  confirmed: { label: "Submitted", tone: "brand" },
  allocated: { label: "Scheduled", tone: "brand" },
  processing: { label: "Being Prepared", tone: "warning" },
  ready_for_dispatch: { label: "Ready for Dispatch", tone: "brand" },
  dispatched: { label: "In Transit", tone: "info" },
  delivered: { label: "Arrived", tone: "success" },
  completed: { label: "Completed", tone: "success" },
  deferred: { label: "Deferred", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function OrderStatusPill({
  order,
  context = "request",
}: {
  order: Pick<StoreOrder, "status" | "deliveryAlert">;
  /** Deliveries wording: "On the Way" instead of "In Transit". */
  context?: "request" | "delivery";
}) {
  if (context === "delivery" && order.deliveryAlert === "vehicle_unavailable") {
    return <StorePill tone="destructive">Vehicle Unavailable</StorePill>;
  }
  const display = orderStatusDisplay[order.status];
  const label = context === "delivery" && order.status === "dispatched" ? "On the Way" : display.label;
  return <StorePill tone={display.tone}>{label}</StorePill>;
}

export function PriorityPill({ isHighPriority }: { isHighPriority: boolean }) {
  return isHighPriority ? (
    <StorePill tone="destructive">High Priority</StorePill>
  ) : (
    <StorePill tone="neutral">Default</StorePill>
  );
}
