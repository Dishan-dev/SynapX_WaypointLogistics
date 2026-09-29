"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Snowflake, Truck } from "lucide-react";
import { CapacityCard } from "@/components/loader/capacity-card";
import { InfoChip } from "@/components/loader/info-chip";
import { LoadMap } from "@/components/loader/load-map";
import { LoaderButton } from "@/components/loader/loader-button";
import { LoaderCard } from "@/components/loader/loader-card";
import { LoaderPill, type LoaderPillTone } from "@/components/loader/loader-pill";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { useLoaderSync, useOfflineRun } from "@/components/loader/loader-sync-provider";
import { OrderRow } from "@/components/loader/order-row";
import { StopHeader } from "@/components/loader/stop-header";
import {
  formatClock,
  formatKg,
  formatM3,
  formatTime,
  isActiveOrder,
  loadMapSlots,
  loadOrderLabel,
  planSource,
  runCapacity,
  stopsInLoadOrder,
  stopTitle,
} from "@/lib/loader/format";
import type { OrderState, QueuedActionType, Run, RunOrder, RunStatus, RunStop } from "@/lib/loader/types";
import { loadRun, ordersLoaded, type LoadResult } from "./checklist-data";
import { reviewHref } from "./routes";

// Same labels and tones as the queue's run card.
const statusPill: Record<RunStatus, { tone: LoaderPillTone; label: string }> = {
  not_started: { tone: "neutral", label: "Not started" },
  loading: { tone: "warning", label: "Loading" },
  issue_flagged: { tone: "error", label: "Issue flagged" },
  loaded: { tone: "primary", label: "Loaded" },
  ready_to_depart: { tone: "success", label: "Ready to depart" },
  gated_out: { tone: "neutral", label: "Gated out" },
};

const BRAND_LABELS = { fresh: "Fresh", style: "Style", tech: "Tech" } as const;

// What tapping a row's check tile sends. re_check is left out for now: the
// outbox sends check for it, which the API refuses (it confirms re_check with
// POST .../recheck). Other states are not toggleable.
const toggleAction: Partial<Record<OrderState, QueuedActionType>> = {
  to_load: "check",
  new: "check",
  loaded: "uncheck",
};

// Once signed off or through the gate the checklist is read-only; reopening
// after Ready is the plan-change flow (L7).
const CLOSED: RunStatus[] = ["ready_to_depart", "gated_out"];

export function ChecklistView({ code }: { code: string }) {
  const { transport } = useLoaderSync();
  const [result, setResult] = React.useState<LoadResult>();

  React.useEffect(() => {
    let cancelled = false;
    void loadRun(code, transport).then((loaded) => {
      if (!cancelled) setResult(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [code, transport]);

  if (!result) {
    return (
      <LoaderScreen title="Loading checklist">
        <p role="status" className="text-sm text-muted-foreground">
          Loading {code}…
        </p>
      </LoaderScreen>
    );
  }
  if (result.kind !== "ok") {
    return (
      <LoaderScreen title="Loading checklist">
        <div className="mx-auto flex max-w-md flex-col gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-base font-semibold text-primary">
            {result.kind === "not_found" ? `${code} is not on this dock's queue.` : `${code} is not available offline.`}
          </p>
          <p className="text-sm text-muted-foreground">
            {result.kind === "not_found"
              ? "Check the run code, or pick the run from the queue."
              : "This tablet has not opened the run before. Reconnect to load it."}
          </p>
          <Link href="/loader" className="text-sm font-medium text-info underline-offset-4 hover:underline">
            Back to the queue
          </Link>
        </div>
      </LoaderScreen>
    );
  }
  return <Checklist initial={result.run} />;
}

function Checklist({ initial }: { initial: Run }) {
  const router = useRouter();
  const { user } = useLoaderShell();
  const { run, act } = useOfflineRun(initial, user.shortName);

  const capacity = runCapacity(run);
  const stops = stopsInLoadOrder(run.stops);
  const slots = loadMapSlots(run);
  const status = statusPill[run.status];
  const closed = CLOSED.includes(run.status);
  const loaded = ordersLoaded(run);
  const { orders_checked: checked, orders_total: total } = run;
  const reviewUnlocked = total > 0 && checked === total && !closed;
  const vehicleLabel = run.vehicle.vehicle_type === "van" ? "Van" : "Truck";
  const reefer = run.vehicle.temp_capability === "reefer";
  const href = reviewHref(run.code);

  React.useEffect(() => {
    if (reviewUnlocked) router.prefetch(href);
  }, [reviewUnlocked, router, href]);

  const onToggle = (order: RunOrder) => {
    const action = toggleAction[order.state];
    if (action) void act(action, { order_number: order.order_number });
  };

  const footer = (
    <div className="flex flex-col gap-2 md:flex-row-reverse md:items-center md:justify-between md:gap-4">
      <LoaderButton
        className="w-full md:w-auto"
        disabled={!reviewUnlocked}
        onClick={() => router.push(href)}
      >
        Review &amp; confirm · {checked} of {total}
      </LoaderButton>
      <p className="text-xs leading-[17px] text-muted-foreground">{footerHint(run)}</p>
    </div>
  );

  return (
    <LoaderScreen
      title="Loading checklist"
      subtitle={`${run.code} · ${run.dock} · ${user.shortName}`}
      plan={planSource(run)}
      footer={footer}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 md:grid md:grid-cols-[248px_1fr] md:items-start md:gap-6">
        <aside aria-label="Vehicle" className="hidden flex-col gap-4 md:sticky md:top-28 md:flex">
          <CapacityCard {...capacity} />
          <LoaderCard title="Load map" description="Cab to door, as seen from the dock">
            <LoadMap slots={slots} spareM3={capacity.spareM3} />
          </LoaderCard>
        </aside>

        <div className="flex min-w-0 flex-col gap-4">
          <header className="flex flex-col gap-1.5">
            <Link
              href="/loader"
              className="w-fit rounded-sm text-xs leading-[17px] font-medium text-muted-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Queue / {run.code}
            </Link>
            <h1 className="text-xl leading-[26px] font-semibold text-primary">
              {run.vehicle.code} · Trip {run.trip_number}
              <span className="hidden md:inline"> · Loading checklist</span>
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <LoaderPill tone={status.tone}>{status.label}</LoaderPill>
              <InfoChip icon={<Truck />}>{vehicleLabel}</InfoChip>
              {reefer && (
                <InfoChip tone="info" icon={<Snowflake />}>
                  Reefer
                </InfoChip>
              )}
              <InfoChip className="hidden md:inline-flex">
                {formatKg(run.vehicle.max_weight_kg)} · {formatM3(run.vehicle.max_volume_m3)}
              </InfoChip>
            </div>
            <p className="text-xs leading-[17px] text-muted-foreground">
              {BRAND_LABELS[run.brand]} · {run.district} · {run.stops.length} stops · departs{" "}
              {formatTime(run.departs_at)}
              <span className="hidden md:inline">
                {" "}· {loaded} of {total} orders in
              </span>
            </p>
          </header>

          <div className="flex flex-col gap-4 md:hidden">
            <CapacityCard {...capacity} />
            <LoaderCard
              title={`${vehicleLabel}, cab to door`}
              description={`${loaded} of ${total} orders in · ${loadMapHint(run, loaded)}`}
            >
              <LoadMap slots={slots} spareM3={capacity.spareM3} orientation="horizontal" />
            </LoaderCard>
          </div>

          {stops.map((stop) => (
            <section
              key={stop.stop_sequence}
              aria-label={`Stop ${stop.stop_sequence}, ${stop.outlet.code}`}
              className="flex flex-col gap-2"
            >
              {stop.eta ? (
                <StopHeader stop={stop} stopCount={stops.length} />
              ) : (
                <StopHeaderWithoutEta stop={stop} stopCount={stops.length} />
              )}
              {stop.orders.map((order) => (
                <OrderRow
                  key={order.order_number}
                  order={order}
                  onToggle={closed || !toggleAction[order.state] ? undefined : onToggle}
                  // Flag stays disabled until Sanduni's flag sheet (L5) lands; then pass onFlag.
                />
              ))}
            </section>
          ))}
        </div>
      </div>
    </LoaderScreen>
  );
}

/**
 * StopHeader for a stop a plan change just added, which has no ETA yet. The
 * API sends eta: null there, and StopHeader formats the ETA unconditionally.
 */
function StopHeaderWithoutEta({ stop, stopCount }: { stop: RunStop; stopCount: number }) {
  const details = [
    stop.outlet.dock_type,
    `${formatClock(stop.outlet.window_start)}–${formatClock(stop.outlet.window_end)}`,
    "ETA pending",
  ];
  if (stop.note) details.push(stop.note);
  return (
    <div className="flex flex-col gap-1 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary px-2.5 py-[3px] text-xs leading-[17px] font-medium text-primary-foreground">
          {loadOrderLabel(stop.load_position, stopCount)}
        </span>
        <h2 className="text-base leading-[22px] font-semibold text-primary">{stopTitle(stop)}</h2>
      </div>
      <p className="text-xs leading-[17px] text-muted-foreground">{details.join(" · ")}</p>
    </div>
  );
}

/** Active orders that still need the loader (not loaded, not flagged). */
function openOrders(run: Run): RunOrder[] {
  return run.stops
    .flatMap((s) => s.orders)
    .filter((o) => isActiveOrder(o) && o.state !== "loaded" && o.state !== "flagged");
}

function onlyNewOrdersLeft(run: Run): boolean {
  const open = openOrders(run);
  return open.length > 0 && open.every((o) => o.state === "new");
}

/** Second line of the cab-to-door card (Figma 1c, 1c.1, 9, 10). */
function loadMapHint(run: Run, loaded: number): string {
  if (run.orders_total > 0 && run.orders_checked === run.orders_total) return "close the door";
  if (onlyNewOrdersLeft(run)) return "new order goes by the door";
  const next = stopsInLoadOrder(run.stops).find((stop) =>
    stop.orders.some((o) => isActiveOrder(o) && o.state !== "loaded" && o.state !== "flagged"),
  );
  if (!next) return "nothing to load";
  return loaded === 0 ? `start at the cab with Stop ${next.stop_sequence}` : `next: Stop ${next.stop_sequence}`;
}

/** Line under the review button (Figma 1c, 1c.1, 9, 10, 16). */
function footerHint(run: Run): string {
  if (CLOSED.includes(run.status)) return `${statusPill[run.status].label}. The checklist is closed.`;
  const { orders_checked: checked, orders_total: total } = run;
  if (total > 0 && checked === total) {
    const done = checked > ordersLoaded(run) ? "checked or flagged" : "checked";
    return `All ${total} orders ${done}. Review once, then release.`;
  }
  if (onlyNewOrdersLeft(run)) return "Load the new order by the door to unlock.";
  return `Unlocks when all ${total} orders are checked or flagged.`;
}
