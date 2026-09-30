"use client";

import { ArrowUpRight } from "lucide-react";
import { LoaderButton } from "@/components/loader/loader-button";
import { LoaderCard } from "@/components/loader/loader-card";
import { TempBadge } from "@/components/loader/temp-badge";
import { formatOrderSize } from "@/lib/loader/format";
import type { RunStop } from "@/lib/loader/types";
import type { DiffOrder } from "./plan-diff";

interface UnloadCardProps {
  stop: RunStop;
  order: DiffOrder;
  /** The run's stops, to name what has to move to reach the order. */
  stops: RunStop[];
  onUnloaded: () => void;
  disabled?: boolean;
}

/**
 * The pinned "Do this first" task for an order the plan took off the truck
 * (Figma T2b). It sits above everything else until the loader confirms the
 * order is back in the chiller or staging; release stays locked until then.
 */
export function UnloadCard({ stop, order, stops, onUnloaded, disabled }: UnloadCardProps) {
  const back = order.temperature_class === "chilled" ? "the chiller dock" : "staging";
  // Orders loaded after this stop sit in front of it; the re-checks among them
  // are the ones the plan says were moved to reach it.
  const inTheWay = stops
    .filter((s) => s.load_position > stop.load_position)
    .flatMap((s) => s.orders)
    .filter((o) => o.state === "re_check")
    .map((o) => o.order_number);
  const where = `${stop.outlet.code}${stop.load_position === 1 ? " · deepest" : ""}`;
  const how = inTheWay.length
    ? `Move ${joinNames(inTheWay)} out to reach it, then return it to ${back}.`
    : `Return it to ${back}.`;

  return (
    <LoaderCard
      className="border-destructive/40 bg-destructive-muted"
      title={
        <span className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <ArrowUpRight className="size-4" aria-hidden />
          Do this first
        </span>
      }
    >
      <div className="flex flex-col gap-2">
        <h3 className="text-lg leading-6 font-semibold text-primary">Unload {order.order_number}</h3>
        <TempBadge temp={order.temperature_class} className="w-fit" />
        <p className="text-sm leading-5 text-foreground">
          {formatOrderSize(order)} · {where}. {how}
        </p>
      </div>
      <LoaderButton variant="destructive" className="w-full" onClick={onUnloaded} disabled={disabled}>
        Unloaded · {order.units} units off
      </LoaderButton>
    </LoaderCard>
  );
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
