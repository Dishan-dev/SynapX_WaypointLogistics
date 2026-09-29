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
import { useOfflineRun } from "@/components/loader/loader-sync-provider";
import { OrderRow } from "@/components/loader/order-row";
import { StopHeader } from "@/components/loader/stop-header";
import {
  formatKg,
  formatM3,
  formatTime,
  isActiveOrder,
  loadMapSlots,
  loadOrderLabel,
  planSource,
  runCapacity,
  runSummary,
  runTotals,
  stopsInLoadOrder,
  stopTitle,
  type RunTotals,
} from "@/lib/loader/format";
import type { LoadState, QueuedActionType, Run, RunStatus, RunStop } from "@/lib/loader/types";
import { loadRun, type LoadResult } from "./checklist-data";
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

// What tapping a row's check tile sends. Other states are not toggleable.
const toggleAction: Partial<Record<LoadState, QueuedActionType>> = {
  to_load: "check",
  new: "check",
  loaded: "uncheck",
  re_check: "recheck",
};

// Once signed off or through the gate the checklist is read-only; reopening
// after Ready is the plan-change flow (L7).
const CLOSED: RunStatus[] = ["ready_to_depart", "gated_out"];

export function ChecklistView({ code }: { code: string }) {
  const [result, setResult] = React.useState<LoadResult>();

  React.useEffect(() => {
    let cancelled = false;
    void loadRun(code).then((loaded) => {
      if (!cancelled) setResult(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

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
  const { user, dockLabel } = useLoaderShell();
  const { run, act } = useOfflineRun(initial, user.shortName);

  const summary = runSummary(run);
  const totals = runTotals(run);
  const capacity = runCapacity(run);
  const stops = stopsInLoadOrder(run.stops);
  const slots = loadMapSlots(run);
  const status = statusPill[run.status];
  const closed = CLOSED.includes(run.status);
  const reviewUnlocked = totals.orders > 0 && totals.resolved === totals.orders && !closed;
  const dockName = dockLabel.split(" · ").pop() ?? dockLabel;
  const href = reviewHref(run.run_code);

  React.useEffect(() => {
    if (reviewUnlocked) router.prefetch(href);
  }, [reviewUnlocked, router, href]);

  const onToggle = (order: { order_number: string; load_state: LoadState }) => {
    const action = toggleAction[order.load_state];
    if (action) void act(action, { order_number: order.order_number });
  };

  const footer = (
    <div className="flex flex-col gap-2 md:flex-row-reverse md:items-center md:justify-between md:gap-4">
      <LoaderButton
        className="w-full md:w-auto"
        disabled={!reviewUnlocked}
        onClick={() => router.push(href)}
      >
        Review &amp; confirm · {totals.resolved} of {totals.orders}
      </LoaderButton>
      <p className="text-xs leading-[17px] text-muted-foreground">{footerHint(run, totals)}</p>
    </div>
  );

  return (
    <LoaderScreen
      title="Loading checklist"
      subtitle={`${run.run_code} · ${dockName} · ${user.shortName}`}
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
              Queue / {run.run_code}
            </Link>
            <h1 className="text-xl leading-[26px] font-semibold text-primary">
              {run.vehicle.vehicle_code} · Trip {run.trip_number}
              <span className="hidden md:inline"> · Loading checklist</span>
            </h1>
            <div className="flex flex-wrap items-center gap-1.5">
              <LoaderPill tone={status.tone}>{status.label}</LoaderPill>
              <InfoChip icon={<Truck />}>{summary.vehicleLabel}</InfoChip>
              {summary.reefer && (
                <InfoChip tone="info" icon={<Snowflake />}>
                  Reefer
                </InfoChip>
              )}
              <InfoChip className="hidden md:inline-flex">
                {formatKg(run.vehicle.max_weight_kg)} · {formatM3(run.vehicle.max_volume_m3)}
              </InfoChip>
            </div>
            <p className="text-xs leading-[17px] text-muted-foreground">
              {summary.subtitle} · departs {summary.departs}
              <span className="hidden md:inline">
                {" "}· {totals.loaded} of {totals.orders} orders in
              </span>
            </p>
          </header>

          <div className="flex flex-col gap-4 md:hidden">
            <CapacityCard {...capacity} />
            <LoaderCard
              title={`${summary.vehicleLabel}, cab to door`}
              description={`${totals.loaded} of ${totals.orders} orders in · ${loadMapHint(run, totals)}`}
            >
              <LoadMap slots={slots} spareM3={capacity.spareM3} orientation="horizontal" />
            </LoaderCard>
          </div>

          {stops.map((stop) => (
            <section
              key={stop.stop_sequence}
              aria-label={`Stop ${stop.stop_sequence}, ${stop.outlet.outlet_code}`}
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
                  onToggle={closed ? undefined : onToggle}
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
 * StopHeader for a stop a plan change just added, which has no ETA yet.
 * StopHeader formats stop.eta unconditionally, and an empty one throws.
 */
function StopHeaderWithoutEta({ stop, stopCount }: { stop: RunStop; stopCount: number }) {
  const details = [stop.outlet.dock_type, `${stop.outlet.window_start}–${stop.outlet.window_end}`, "ETA pending"];
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

/** Stops whose active orders still need the loader, in load order. */
function openStops(run: Run): RunStop[] {
  return stopsInLoadOrder(run.stops).filter((stop) =>
    stop.orders.some((o) => isActiveOrder(o) && o.load_state !== "loaded" && o.load_state !== "flagged"),
  );
}

function onlyNewOrdersLeft(run: Run): boolean {
  const open = run.stops.flatMap((s) => s.orders).filter(
    (o) => isActiveOrder(o) && o.load_state !== "loaded" && o.load_state !== "flagged",
  );
  return open.length > 0 && open.every((o) => o.load_state === "new");
}

/** Second line of the cab-to-door card (Figma 1c, 1c.1, 9, 10). */
function loadMapHint(run: Run, totals: RunTotals): string {
  if (totals.orders > 0 && totals.resolved === totals.orders) return "close the door";
  if (onlyNewOrdersLeft(run)) return "new order goes by the door";
  const next = openStops(run)[0];
  if (!next) return "nothing to load";
  return totals.loaded === 0
    ? `start at the cab with Stop ${next.stop_sequence}`
    : `next: Stop ${next.stop_sequence}`;
}

/** Line under the review button (Figma 1c, 1c.1, 9, 10, 16). */
function footerHint(run: Run, totals: RunTotals): string {
  if (CLOSED.includes(run.status)) {
    return run.signed_off_by && run.signed_off_at
      ? `Signed off by ${run.signed_off_by} at ${formatTime(run.signed_off_at)}. The checklist is closed.`
      : "Signed off. The checklist is closed.";
  }
  if (totals.orders > 0 && totals.resolved === totals.orders) {
    const flagged = totals.resolved - totals.loaded;
    const done = flagged ? "checked or flagged" : "checked";
    return `All ${totals.orders} orders ${done}. Review once, then release.`;
  }
  if (onlyNewOrdersLeft(run)) return "Load the new order by the door to unlock.";
  return `Unlocks when all ${totals.orders} orders are checked or flagged.`;
}
