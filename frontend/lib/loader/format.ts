import type { IssueType, LoaderIssue, LoaderUser, Run, RunOrder, RunStop } from "./types";

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

export type LoadMapSlotState = "loaded" | "loading" | "new" | "pending";

export interface LoadMapSlot {
  stopSequence: number;
  outletCode: string;
  /** Planned volume of the stop's active orders. */
  volumeM3: number;
  state: LoadMapSlotState;
}

/** One slot per stop, cab to door (load order), sized by planned volume. */
export function loadMapSlots(run: Run): LoadMapSlot[] {
  return stopsInLoadOrder(run.stops).map((stop) => {
    const active = stop.orders.filter(isActiveOrder);
    const loaded = active.filter((o) => o.load_state === "loaded").length;
    let state: LoadMapSlotState = "pending";
    if (active.length > 0 && loaded === active.length) state = "loaded";
    else if (loaded > 0) state = "loading";
    else if (stop.is_new) state = "new";
    const volume = active.reduce((sum, o) => sum + o.volume_m3, 0);
    return {
      stopSequence: stop.stop_sequence,
      outletCode: stop.outlet.outlet_code,
      volumeM3: Math.round(volume * 10) / 10,
      state,
    };
  });
}

/** Vehicle limits and run totals in the shape the capacity card takes. */
export function runCapacity(run: Run) {
  const totals = runTotals(run);
  return {
    vehicleCode: run.vehicle.vehicle_code,
    planVersion: run.plan_version,
    weight: { loaded: totals.loadedKg, planned: totals.plannedKg, max: run.vehicle.max_weight_kg },
    volume: { loaded: totals.loadedM3, planned: totals.plannedM3, max: run.vehicle.max_volume_m3 },
    spareM3: Math.max(0, Math.round((run.vehicle.max_volume_m3 - totals.plannedM3) * 10) / 10),
  };
}

/** "Stop 1 · OUT028 · NEW STOP" */
export function stopTitle(stop: RunStop): string {
  return `Stop ${stop.stop_sequence} · ${stop.outlet.outlet_code}${stop.is_new ? " · NEW STOP" : ""}`;
}

export interface PlanSource {
  version?: number;
  updatedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

/** Plan details for the source strip, from a run's plan fields. */
export function planSource(run: Run): PlanSource {
  const acknowledged = run.acknowledged_plan_version === run.plan_version;
  return {
    version: run.plan_version,
    updatedAt: run.plan_updated_at,
    acknowledgedBy: acknowledged ? run.acknowledged_by : undefined,
    acknowledgedAt: acknowledged ? run.acknowledged_at : undefined,
  };
}

const BRAND_LABELS = { fresh: "Fresh", style: "Style", tech: "Tech" } as const;

/** Display fields for a run card, so components never read raw API fields. */
export function runSummary(run: Run) {
  const totals = runTotals(run);
  const ready = run.status === "ready_to_depart";
  let progressNote = `${totals.loaded} of ${totals.orders} loaded`;
  if (ready && run.signed_off_by) {
    progressNote += ` · signed off by ${run.signed_off_by}`;
    if (run.signed_off_at) progressNote += ` ${formatTime(run.signed_off_at)}`;
  } else if (run.loading_by?.length) {
    progressNote += ` · ${run.loading_by.join(", ")}`;
  }
  return {
    runCode: run.run_code,
    status: run.status,
    title: `${run.run_code} · ${run.vehicle.vehicle_code} · Trip ${run.trip_number}`,
    subtitle: `${BRAND_LABELS[run.brand]} · ${run.area} · ${run.stops.length} stops`,
    departs: formatTime(run.departs_at),
    vehicleLabel: run.vehicle.vehicle_type === "van" ? "Van" : "Truck",
    reefer: run.vehicle.is_reefer,
    vanOnly: run.stops.some((s) => s.outlet.van_only),
    capacityLabel: `${formatKg(run.vehicle.max_weight_kg)} · ${formatM3(run.vehicle.max_volume_m3)}`,
    progress: totals.orders ? Math.round((totals.loaded / totals.orders) * 100) : 0,
    progressNote,
  };
}

/** "Saman J." plus initials, for the app bar, menu and tiles. */
export function userLabel(user: LoaderUser) {
  const [first, ...rest] = user.full_name.split(" ");
  const last = rest.at(-1);
  return {
    name: user.full_name,
    shortName: last ? `${first} ${last[0]}.` : first,
    initials: user.initials,
  };
}

/** "Good night" / "Good morning" / … for a depot-time ISO timestamp. */
export function greeting(iso: string): string {
  const hour = Number(timeFormat.format(new Date(iso)).slice(0, 2));
  if (hour < 5 || hour >= 22) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const ISSUE_LABELS: Record<IssueType, string> = {
  missing: "missing",
  short: "short",
  damaged: "damaged",
  wont_fit: "won't fit",
};

export interface RunAlert {
  tone: "error" | "warning" | "success";
  message: string;
  actionLabel: string;
  actionHref: string;
}

/** The one alert a run card shows, most urgent first. */
export function runAlert(run: Run, issues: LoaderIssue[]): RunAlert | undefined {
  const open = issues.find(
    (i) => i.run_code === run.run_code && (i.status === "sent" || i.status === "seen"),
  );
  if (open) {
    return {
      tone: "error",
      message: `${open.order_number} ${ISSUE_LABELS[open.issue_type]} · waiting`,
      actionLabel: "Open",
      actionHref: `/loader/issues/${open.issue_id}`,
    };
  }
  const acknowledged = run.acknowledged_plan_version;
  if (acknowledged !== undefined && run.plan_version > acknowledged) {
    return {
      tone: "warning",
      message: `Plan updated ${formatTime(run.plan_updated_at)} · v${acknowledged} → v${run.plan_version}`,
      actionLabel: "Review",
      actionHref: `/loader/runs/${run.run_code}`,
    };
  }
  if (run.status === "ready_to_depart") {
    return {
      tone: "success",
      message: "Signed off · driver can collect",
      actionLabel: "View",
      actionHref: `/loader/runs/${run.run_code}/release`,
    };
  }
  return undefined;
}

/** Queue metric tiles: Runs · Loading · Issues · Ready. */
export function queueMetrics(runs: Run[], issues: LoaderIssue[]) {
  const loading = runs.filter((r) => r.status === "loading" || r.status === "issue_flagged");
  const loaders = [...new Set(loading.flatMap((r) => r.loading_by ?? []))];
  const openIssues = issues.filter((i) => i.status === "sent" || i.status === "seen");
  const ready = runs.filter((r) => r.status === "ready_to_depart");
  return {
    runs: runs.length,
    loading: loading.length,
    loadingCaption: loaders.map((name) => name.split(" ")[0]).join(", "),
    issues: openIssues.length,
    issuesCaption: openIssues.length ? "Awaiting decision" : "None open",
    ready: ready.length,
    readyCaption: ready.map((r) => r.run_code).join(", "),
  };
}

/** Dock-wide plan strip for the queue: the latest plan update across runs. */
export function dockPlanSource(runs: Run[], fallback: string): PlanSource {
  return { updatedAt: runs.map((r) => r.plan_updated_at).sort().at(-1) ?? fallback };
}
