import type { Run, RunOrder, RunStop } from "./types";

const TIME_ZONE = "Asia/Colombo";

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

/** "03:30" in depot time. */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

/** "Thu 28 May" in depot time. */
export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso)).replace(",", "");
}

export function formatKg(kg: number): string {
  return `${kg.toLocaleString("en-US")} kg`;
}

export function formatM3(m3: number): string {
  return `${m3.toFixed(1)} m³`;
}

/** "44 units · 650 kg · 3.2 m³" */
export function formatOrderSize(
  order: Pick<RunOrder, "units" | "weight_kg" | "volume_m3">,
): string {
  return `${order.units} units · ${formatKg(order.weight_kg)} · ${formatM3(order.volume_m3)}`;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}TH`;
  return `${n}${["TH", "ST", "ND", "RD"][n % 10] ?? "TH"}`;
}

/**
 * Label for a stop's load_position (1 = first loaded, deepest).
 * "LOAD 1ST · DEEPEST", "LOAD 2ND", …, "LOAD LAST · BY DOOR".
 */
export function loadOrderLabel(loadPosition: number, stopCount: number): string {
  if (stopCount > 1 && loadPosition === stopCount) return "LOAD LAST · BY DOOR";
  if (loadPosition === 1) return "LOAD 1ST · DEEPEST";
  return `LOAD ${ordinal(loadPosition)}`;
}

/** Stops in load order: load_position 1 (deepest) first. */
export function stopsInLoadOrder(stops: RunStop[]): RunStop[] {
  return [...stops].sort((a, b) => a.load_position - b.load_position);
}

/**
 * Status line under an order: the order's note when it has one, otherwise
 * "Loaded 01:41 · Saman J." (or "Re-checked …" after a plan change).
 */
export function orderStatusLine(order: RunOrder): string | undefined {
  if (order.note) return order.note;
  if (order.load_state !== "loaded" || !order.checked_at) return undefined;
  const verb = order.changed_in_version ? "Re-checked" : "Loaded";
  const by = order.checked_by ? ` · ${order.checked_by}` : "";
  return `${verb} ${formatTime(order.checked_at)}${by}`;
}

/** "rear_dock · 03:00–08:00 · ETA 05:20 · 1 dry + 1 chilled" */
export function formatStopDetails(stop: RunStop): string {
  const parts = [
    stop.outlet.dock_type,
    `${stop.outlet.window_start}–${stop.outlet.window_end}`,
    `ETA ${formatTime(stop.eta)}`,
  ];
  if (stop.note) parts.push(stop.note);
  return parts.join(" · ");
}

/** Orders that are part of the current plan and must be resolved before release. */
export function isActiveOrder(order: RunOrder): boolean {
  return order.load_state !== "moved" && order.load_state !== "take_off";
}

export interface RunTotals {
  /** Active orders on the plan. */
  orders: number;
  /** Active orders checked onto the vehicle. */
  loaded: number;
  /** Active orders loaded or flagged, i.e. no longer blocking review. */
  resolved: number;
  loadedKg: number;
  loadedM3: number;
  plannedKg: number;
  plannedM3: number;
}

export function runTotals(run: Run): RunTotals {
  const totals: RunTotals = {
    orders: 0,
    loaded: 0,
    resolved: 0,
    loadedKg: 0,
    loadedM3: 0,
    plannedKg: 0,
    plannedM3: 0,
  };
  for (const stop of run.stops) {
    for (const order of stop.orders) {
      if (!isActiveOrder(order)) continue;
      totals.orders += 1;
      totals.plannedKg += order.weight_kg;
      totals.plannedM3 += order.volume_m3;
      if (order.load_state === "loaded") {
        totals.loaded += 1;
        totals.loadedKg += order.weight_kg;
        totals.loadedM3 += order.volume_m3;
      }
      if (order.load_state === "loaded" || order.load_state === "flagged") {
        totals.resolved += 1;
      }
    }
  }
  totals.loadedM3 = Math.round(totals.loadedM3 * 10) / 10;
  totals.plannedM3 = Math.round(totals.plannedM3 * 10) / 10;
  return totals;
}

/** Whole-number percentage of a limit, e.g. 85. */
export function percentOf(value: number, max: number): number {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}
