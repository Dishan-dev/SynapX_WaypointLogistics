"use client";

import * as React from "react";
import { ArrowUpRight, Ban, Check, Flag, RefreshCw } from "lucide-react";
import { cn } from "cn";
import { FLAGGABLE_STATES, formatOrderSize, orderStatusLine } from "@/lib/loader/format";
import type { OrderState, RunOrder } from "@/lib/loader/types";
import { useFlagWaiting } from "./flag-status";
import { LoaderPill } from "./loader-pill";
import { TempBadge } from "./temp-badge";

interface StateStyle {
  row: string;
  tile: string;
  note: string;
  icon?: React.ReactNode;
  /** The check tile toggles loaded / not loaded in this state. */
  toggleable: boolean;
}

const tileIcon = "size-[26px]";

const stateStyles: Record<OrderState, StateStyle> = {
  to_load: {
    row: "border-border bg-card",
    tile: "border-2 border-muted-foreground/40 bg-card",
    note: "text-muted-foreground",
    toggleable: true,
  },
  loaded: {
    row: "border-border bg-card",
    tile: "bg-primary text-primary-foreground",
    note: "text-success",
    icon: <Check className={tileIcon} aria-hidden />,
    toggleable: true,
  },
  flagged: {
    row: "border-destructive/30 bg-destructive-muted",
    tile: "bg-destructive text-white",
    note: "text-destructive",
    icon: <Flag className={tileIcon} aria-hidden />,
    toggleable: false,
  },
  re_check: {
    row: "border-warning/40 bg-warning-muted",
    tile: "border-2 border-warning bg-card text-warning",
    note: "text-warning-muted-foreground",
    icon: <RefreshCw className={tileIcon} aria-hidden />,
    toggleable: true,
  },
  take_off: {
    row: "border-destructive/30 bg-destructive-muted",
    tile: "border-2 border-destructive bg-card text-destructive",
    note: "text-destructive",
    icon: <ArrowUpRight className={tileIcon} aria-hidden />,
    toggleable: false,
  },
  moved: {
    row: "border-border bg-background",
    tile: "border border-border bg-background text-muted-foreground",
    note: "text-muted-foreground",
    icon: <Ban className={tileIcon} aria-hidden />,
    toggleable: false,
  },
  new: {
    row: "border-info/30 bg-info-muted",
    tile: "border-2 border-info bg-card",
    note: "text-info-muted-foreground",
    toggleable: true,
  },
};

// Spoken state for the check tile, so state is never colour-only.
const stateLabels: Record<OrderState, string> = {
  to_load: "to load",
  loaded: "loaded",
  flagged: "flagged",
  re_check: "needs re-check",
  take_off: "take off the vehicle",
  moved: "not on this trip",
  new: "new, to load",
};

interface OrderRowProps {
  order: RunOrder;
  /** Check / uncheck the order. Offered in to_load, loaded, re_check (a check clears it) and new. */
  onToggle?: (order: RunOrder) => void;
  /**
   * Open the flag-an-issue flow for this order. Leave it out where no flag is
   * allowed (a closed run); the button then does not show.
   */
  onFlag?: (order: RunOrder) => void;
  disabled?: boolean;
  className?: string;
}

/** One order in the loading checklist, in any of the seven Figma states. */
export function OrderRow({ order, onToggle, onFlag, disabled = false, className }: OrderRowProps) {
  const style = stateStyles[order.state];
  const isMoved = order.state === "moved";
  const flagWaiting = useFlagWaiting(order.order_number);
  // Figma "6 Order row states": a flag still waiting on the Dispatcher says so.
  // An answered flag gets no line; no frame defines its wording.
  const statusLine =
    orderStatusLine(order) ?? (order.state === "flagged" && flagWaiting ? "Flagged · waiting on Dispatcher" : undefined);
  const canToggle = style.toggleable && !!onToggle && !disabled;
  // Only where the server takes a flag: never twice on one row (a flag queued
  // offline counts at once), never on take_off or moved rows. No re-flagging.
  const canFlag = FLAGGABLE_STATES.includes(order.state) && !flagWaiting && !!onFlag && !disabled;

  const tileClass = cn(
    "flex size-12 shrink-0 items-center justify-center rounded-lg",
    style.tile,
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border py-3 pr-2.5 pl-3",
        style.row,
        className,
      )}
    >
      {style.toggleable ? (
        <button
          type="button"
          aria-pressed={order.state === "loaded"}
          aria-label={`${order.order_number}: ${stateLabels[order.state]}. ${
            order.state === "loaded" ? "Mark not loaded" : "Mark loaded"
          }`}
          disabled={!canToggle}
          onClick={() => onToggle?.(order)}
          className={cn(
            tileClass,
            "outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default",
          )}
        >
          {style.icon}
        </button>
      ) : (
        <div role="img" aria-label={`${order.order_number}: ${stateLabels[order.state]}`} className={tileClass}>
          {style.icon}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "text-base leading-[22px] font-semibold",
              isMoved ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {order.order_number}
          </span>
          <TempBadge temp={order.temperature_class} />
          {/* Figma 1c "Removed in v3"; 2c "Not on this trip" when the version is unknown. */}
          {isMoved && (
            <LoaderPill tone="neutral">
              {order.changed_in_version != null ? `Removed in v${order.changed_in_version}` : "Not on this trip"}
            </LoaderPill>
          )}
        </div>
        <p className="text-xs leading-[17px] text-muted-foreground">{formatOrderSize(order)}</p>
        {statusLine && (
          <p className={cn("text-xs leading-[17px] font-medium", style.note)}>{statusLine}</p>
        )}
      </div>

      {canFlag && (
        <button
          type="button"
          aria-label={`Flag an issue with ${order.order_number}`}
          onClick={() => onFlag?.(order)}
          className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Flag className="size-5" aria-hidden />
        </button>
      )}
    </div>
  );
}
