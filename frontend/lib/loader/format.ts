// Display helpers for loader screens. Components read API shapes only through
// these functions, so a contract rename stays in lib/loader.

import type {
  ActivityEntry,
  LoaderSession,
  LoaderUser,
  MovedTo,
  QueueSummary,
  ReleaseBlocker,
  Run,
  RunAlert,
  RunOrder,
  RunQueue,
  RunStop,
  RunSummary,
} from "./types";

// ---- Time ------------------------------------------------------------------

const TIME_ZONE = "Asia/Colombo";

const zonedParts = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: TIME_ZONE,
});

interface LocalDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Depot wall-clock parts of an API timestamp. The API sends UTC with a Z
 * ("2026-05-27T22:00:00Z" is 03:30 on 28 May in the depot). A timestamp without
 * an offset is UTC by the same convention, so it is never read in the tablet's
 * own timezone. Delivery windows ("05:00:00") are not timestamps; they go
 * through formatClock.
 */
export function parseLocalDateTime(iso: string): LocalDateTime {
  const utc = /(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`;
  const parts = Object.fromEntries(
    zonedParts.formatToParts(new Date(utc)).map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "03:30" */
export function formatTime(iso: string): string {
  const t = parseLocalDateTime(iso);
  return `${pad(t.hour)}:${pad(t.minute)}`;
}

/** "Thu 28 May" */
export function formatDay(iso: string): string {
  const t = parseLocalDateTime(iso);
  const date = new Date(Date.UTC(t.year, t.month - 1, t.day));
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(date)
    .replace(",", "");
}

/** "Thu 28 May 2026" */
export function formatDate(iso: string): string {
  return `${formatDay(iso)} ${parseLocalDateTime(iso).year}`;
}

/** "Night shift" from 18:00 to 06:00 depot time, otherwise "Day shift". */
export function shiftLabel(iso: string): string {
  const { hour } = parseLocalDateTime(iso);
  return hour < 6 || hour >= 18 ? "Night shift" : "Day shift";
}

/** Delivery window time "05:00:00" → "05:00". Already depot time; shown as-is. */
export function formatClock(hms: string): string {
  return hms.slice(0, 5);
}

/** "Good night" / "Good morning" / … by the depot hour of a timestamp. */
export function greeting(iso: string): string {
  const { hour } = parseLocalDateTime(iso);
  if (hour < 5 || hour >= 22) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// ---- Quantities -------------------------------------------------------------

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

/** Whole-number percentage of a limit, e.g. 85. */
export function percentOf(value: number, max: number): number {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

// ---- Stops and orders ---------------------------------------------------------

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

/** "Stop 1 · OUT028 · NEW STOP" */
export function stopTitle(stop: RunStop): string {
  return `Stop ${stop.stop_sequence} · ${stop.outlet.code}${stop.is_new ? " · NEW STOP" : ""}`;
}

/** "rear_dock · 03:00–08:00 · ETA 05:20 · 1 dry + 1 chilled" ("ETA pending" without one) */
export function formatStopDetails(stop: RunStop): string {
  const parts = [
    stop.outlet.dock_type,
    `${formatClock(stop.outlet.window_start)}–${formatClock(stop.outlet.window_end)}`,
    stop.eta ? `ETA ${formatTime(stop.eta)}` : "ETA pending",
  ];
  if (stop.note) parts.push(stop.note);
  return parts.join(" · ");
}

/** "VEH003 · Trip 1 · 03:45" */
export function movedToLabel(to: MovedTo): string {
  const parts = [to.vehicle_code, `Trip ${to.trip_number}`];
  if (to.departs_at) parts.push(formatTime(to.departs_at));
  return parts.join(" · ");
}

/** A date without a time ("2026-05-29"), as a depot day: "Fri 29 May". */
export function formatDateOnly(date: string): string {
  return formatDay(`${date}T12:00:00+05:30`);
}

/**
 * Status line under an order: where a moved order went ("Moved to VEH003 ·
 * Trip 1 · 03:45", "Deferred to Fri 29 May · off truck 02:24"), its note, or
 * "Loaded 01:41 · Saman J." ("Re-checked …" after a plan change).
 */
export function orderStatusLine(order: RunOrder): string | undefined {
  const where = order.moved_to
    ? `Moved to ${movedToLabel(order.moved_to)}`
    : order.deferred_to
      ? `Deferred to ${formatDateOnly(order.deferred_to)}`
      : undefined;
  if (where) return order.unloaded_at ? `${where} · off truck ${formatTime(order.unloaded_at)}` : where;
  if (order.note) return order.note;
  if (order.state !== "loaded" || !order.checked_at) return undefined;
  const verb = order.changed_in_version ? "Re-checked" : "Loaded";
  const by = order.checked_by ? ` · ${order.checked_by}` : "";
  return `${verb} ${formatTime(order.checked_at)}${by}`;
}

/** Still an order to load: take_off and moved are excluded (contract counting rules). */
export function isActiveOrder(order: RunOrder): boolean {
  return order.state !== "moved" && order.state !== "take_off";
}

// ---- Counts and capacity ----------------------------------------------------------

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Recompute a run's counts and capacity from its orders, following the
 * contract's counting rules. The server's values are used as sent; this is
 * only for runs changed locally by offline actions.
 *
 * - orders_total excludes take_off and moved
 * - orders_loaded counts loaded only (not flagged, not re_check)
 * - orders_checked counts loaded and flagged (not re_check)
 * - loaded capacity counts loaded and re_check (goods are aboard)
 */
export function withRecomputedCounts(run: Run): Run {
  let total = 0;
  let loaded = 0;
  let checked = 0;
  let loadedKg = 0;
  let loadedM3 = 0;
  let plannedKg = 0;
  let plannedM3 = 0;
  for (const stop of run.stops) {
    for (const order of stop.orders) {
      if (!isActiveOrder(order)) continue;
      total += 1;
      plannedKg += order.weight_kg;
      plannedM3 += order.volume_m3;
      if (order.state === "loaded") loaded += 1;
      if (order.state === "loaded" || order.state === "flagged") checked += 1;
      if (order.state === "loaded" || order.state === "re_check") {
        loadedKg += order.weight_kg;
        loadedM3 += order.volume_m3;
      }
    }
  }
  return {
    ...run,
    orders_total: total,
    orders_loaded: loaded,
    orders_checked: checked,
    ...releaseLock(run),
    capacity: {
      ...run.capacity,
      loaded_weight_kg: loadedKg,
      loaded_volume_m3: round1(loadedM3),
      planned_weight_kg: plannedKg,
      planned_volume_m3: round1(plannedM3),
    },
  };
}

/**
 * release_blockers / release_locked recomputed from the rows (contract
 * "Release lock"), for a run changed locally. Waiting issues keep the
 * server's count. Runs without the L7 fields are left without them.
 */
function releaseLock(run: Run): Pick<Run, "release_blockers" | "release_locked"> {
  if (!run.release_blockers) return {};
  const orders = run.stops.flatMap((s) => s.orders);
  const count = (...states: RunOrder["state"][]) => orders.filter((o) => states.includes(o.state)).length;
  const blockers: ReleaseBlocker[] = [
    { code: "plan_not_acknowledged", count: run.unacknowledged_plan_version !== null ? 1 : 0 },
    { code: "unload_pending", count: count("take_off") },
    { code: "re_check_pending", count: count("re_check") },
    { code: "orders_open", count: count("to_load", "new") },
    { code: "issue_waiting", count: run.release_blockers.find((b) => b.code === "issue_waiting")?.count ?? 0 },
  ];
  const open = blockers.filter((b) => b.count > 0);
  return { release_blockers: open, release_locked: open.length > 0 };
}

/** Capacity card props, from the run's server capacity. */
export function runCapacity(run: Run) {
  const c = run.capacity;
  return {
    vehicleCode: run.vehicle.code,
    planVersion: run.current_plan_version,
    weight: { loaded: c.loaded_weight_kg, planned: c.planned_weight_kg, max: c.max_weight_kg },
    volume: { loaded: c.loaded_volume_m3, planned: c.planned_volume_m3, max: c.max_volume_m3 },
    spareM3: Math.max(0, round1(c.max_volume_m3 - c.planned_volume_m3)),
  };
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
    const done = active.filter((o) => o.state === "loaded" || o.state === "flagged").length;
    const started = active.some((o) => o.state !== "to_load" && o.state !== "new");
    let state: LoadMapSlotState = "pending";
    if (active.length > 0 && done === active.length) state = "loaded";
    else if (started) state = "loading";
    else if (stop.is_new) state = "new";
    return {
      stopSequence: stop.stop_sequence,
      outletCode: stop.outlet.code,
      volumeM3: round1(active.reduce((sum, o) => sum + o.volume_m3, 0)),
      state,
    };
  });
}

// ---- Plan source strip ------------------------------------------------------------

export interface PlanSource {
  /** Who published the plan, e.g. "Dispatcher". */
  source?: string;
  version?: number;
  updatedAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

/** Plan details for the source strip, from a run's plan. */
export function planSource(run: Run): PlanSource {
  const { plan } = run;
  return {
    source: plan.source,
    version: plan.version,
    updatedAt: plan.published_at,
    acknowledgedBy: plan.acknowledged_by ?? undefined,
    acknowledgedAt: plan.acknowledged_at ?? undefined,
  };
}

/**
 * Dock-wide strip for the queue: latest plan publish across known runs.
 * The queue and summary responses carry no plan time yet (contract gap).
 */
export function dockPlanSource(runs: Run[]): PlanSource {
  const latest = runs.map((r) => r.plan.published_at).sort().at(-1);
  return { source: "Dispatcher", updatedAt: latest };
}

// ---- Queue cards ---------------------------------------------------------------------

const BRAND_LABELS = { fresh: "Fresh", style: "Style", tech: "Tech" } as const;

export type RunChipKind = "vehicle" | "reefer" | "access" | "plain";

/** How a queue chip string is drawn. The API sends display text only. */
export function runChipKind(label: string): RunChipKind {
  if (label === "Truck" || label === "Van") return "vehicle";
  if (label === "Reefer") return "reefer";
  if (label === "van_only") return "access";
  return "plain";
}

/**
 * The queue card alert for a plan nobody has acknowledged yet (Figma 2c #1,
 * "Plan updated 02:14 · v2 → v3 · Review"), or for a change that reopened a
 * Ready run (2c #7, "Load reopened …"). Built from the run read, for when the
 * queue has no alert of its own for it. Null once acknowledged.
 */
export function planChangeAlert(run: Run): RunAlert | null {
  const to = run.unacknowledged_plan_version;
  if (to === null) return null;
  const from = run.acknowledged_plan_version ?? run.plan_change?.from_version;
  const versions = from != null && from !== to ? `v${from} → v${to}` : `v${to}`;
  const at = formatTime(run.plan_change?.published_at ?? run.plan.published_at);
  const href = `/loader/runs/${encodeURIComponent(run.code)}`;
  if (run.plan_change?.was_ready_at) {
    return {
      tone: "error",
      message: `Load reopened · ${run.code} · ${run.vehicle.code} · ${versions} at ${at}`,
      action: "Open",
      href,
    };
  }
  return { tone: "warning", message: `Plan updated ${at} · ${versions}`, action: "Review", href };
}

/** Display fields for a queue run card. */
export function runCardView(run: RunSummary) {
  // Loaded only: a flagged order is not on the truck (contract counting rules).
  const progress = run.orders_total ? Math.round((run.orders_loaded / run.orders_total) * 100) : 0;
  const note = `${run.orders_loaded} of ${run.orders_total} loaded`;
  return {
    code: run.code,
    status: run.status,
    title: `${run.code} · ${run.vehicle_code} · Trip ${run.trip_number}`,
    subtitle: `${BRAND_LABELS[run.brand]} · ${run.district} · ${run.stop_count} stops`,
    departs: formatTime(run.departs_at),
    chips: run.chips.map((label) => ({ label, kind: runChipKind(label) })),
    progress,
    progressNote: run.loader ? `${note} · ${run.loader}` : note,
    alert: run.alert
      ? {
          tone: run.alert.tone,
          message: run.alert.message,
          actionLabel: run.alert.action,
          actionHref: run.alert.href,
        }
      : undefined,
  };
}

// ---- People and place -----------------------------------------------------------------

/** Name, short name and initials for the shell, tiles and menu. */
export function userLabel(user: LoaderUser) {
  const words = user.full_name.trim().split(/\s+/);
  const initials = (words[0][0] + (words.length > 1 ? words.at(-1)![0] : "")).toUpperCase();
  return { name: user.full_name, shortName: user.short_name, initials };
}

/** "Peliyagoda DC" from a depot slug. */
export function depotName(depot: string): string {
  return `${depot.charAt(0).toUpperCase()}${depot.slice(1)} DC`;
}

/** "Peliyagoda DC · Dock 3" from a session's depot slug and dock. */
export function dockLabel(session: Pick<LoaderSession, "depot" | "dock">): string {
  return `${depotName(session.depot)} · ${session.dock}`;
}

// ---- Sign-in ---------------------------------------------------------------------------

/**
 * The part of a loader's name that a search matches: the start of any word,
 * case-insensitive. Undefined when it does not match.
 */
export function nameMatch(name: string, query: string): { start: number; end: number } | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  const lower = name.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    if ((i === 0 || lower[i - 1] === " ") && lower.startsWith(q, i)) return { start: i, end: i + q.length };
  }
  return undefined;
}

/** Loaders whose first or last name starts with the search, by name. */
export function matchUsers(users: LoaderUser[], query: string): LoaderUser[] {
  return users
    .filter((u) => nameMatch(u.full_name, query))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export interface SignInOverview {
  /** "Dock 3 tonight · plan from Dispatcher, updated 02:14" */
  heading: string;
  nextDeparture?: { time: string; caption: string };
  runs: { count: number; caption: string };
  issues: { count: number; caption: string };
}

/** Tablet sign-in cards (Figma 00 tablet): the dock's night at a glance. */
export function signInOverview(
  queue: RunQueue,
  summary: QueueSummary,
  plan: { updatedAt?: string },
  now: string,
): SignInOverview {
  const runs = queue.groups.flatMap((g) => g.runs);
  const next = runs
    .filter((r) => r.status !== "ready_to_depart" && r.status !== "gated_out")
    .sort((a, b) => a.departs_at.localeCompare(b.departs_at))[0];
  const fresh = runs.filter((r) => r.brand === "fresh").length;
  const when = shiftLabel(now) === "Night shift" ? "tonight" : "today";
  const updated = plan.updatedAt ? `, updated ${formatTime(plan.updatedAt)}` : "";
  return {
    heading: `${summary.dock} ${when} · plan from Dispatcher${updated}`,
    nextDeparture: next && {
      time: formatTime(next.departs_at),
      caption: `${next.code} · ${next.vehicle_code} · ${BRAND_LABELS[next.brand]}`,
    },
    runs: { count: summary.runs, caption: `${fresh} Fresh · ${runs.length - fresh} Style & Tech` },
    issues: { count: summary.issues.count, caption: summary.issues.label },
  };
}

// ---- Activity log (L9) ---------------------------------------------------

export interface ActivityRow {
  key: string;
  /** Depot time, "02:24". */
  time: string;
  /** ISO, for <time dateTime>. */
  at: string;
  summary: string;
}

const ORDER_EVENTS = new Set(["order_checked", "order_unchecked", "order_rechecked", "order_unloaded"]);

/** Log rows as the API sends them: newest first, one row per event. */
export function activityRows(events: ActivityEntry[]): ActivityRow[] {
  return events.map((e) => ({ key: String(e.id), time: formatTime(e.at), at: e.at, summary: e.summary }));
}

/** "ORD0092305/06" – the numbers after the first keep only the digits that differ (at least two). */
function joinOrderNumbers(numbers: string[]): string {
  const [first, ...rest] = numbers;
  return [
    first,
    ...rest.map((n) => {
      let same = 0;
      while (same < n.length && n[same] === first[same]) same += 1;
      return n.slice(Math.min(same, n.length - 2));
    }),
  ].join("/");
}

/** The summary without its leading order number: " re-checked". */
function orderTail(e: ActivityEntry): string | undefined {
  const number = e.order?.order_number;
  return number && ORDER_EVENTS.has(e.type) && e.summary.startsWith(number) ? e.summary.slice(number.length) : undefined;
}

/** How many rows the checklist's Change log card shows (Figma T1c). */
export const CHANGE_LOG_ROWS = 5;

/**
 * The checklist's Change log card (Figma T1c): oldest first, the last few
 * rows. Order events of the same kind in the same minute by the same loader
 * share a line, as the design writes them: "ORD0092305/06 re-checked".
 */
export function changeLogRows(events: ActivityEntry[], limit = CHANGE_LOG_ROWS): ActivityRow[] {
  const rows: (ActivityRow & { tail?: string; type: string; who: string | null; numbers: string[] })[] = [];
  for (const e of [...events].reverse()) {
    const time = formatTime(e.at);
    const tail = orderTail(e);
    const last = rows[rows.length - 1];
    if (tail && last?.tail === tail && last.type === e.type && last.time === time && last.who === e.actor.name) {
      last.numbers.push(e.order!.order_number);
      last.summary = joinOrderNumbers(last.numbers) + tail;
      continue;
    }
    rows.push({
      key: String(e.id),
      time,
      at: e.at,
      summary: e.summary,
      tail,
      type: e.type,
      who: e.actor.name,
      numbers: e.order ? [e.order.order_number] : [],
    });
  }
  return rows.slice(-limit).map(({ key, time, at, summary }) => ({ key, time, at, summary }));
}
