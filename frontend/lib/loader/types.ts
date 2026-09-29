// Loader module types, from docs/loader/API_CONTRACT.md (loader-sachintha).
//
// - "Built (L0)" shapes are final: RunDetail, Vehicle, Outlet, RunStop,
//   RunOrder, Issue, ActivityEntry.
// - "Proposed" shapes (queue, summary, users, session, writes) follow the
//   contract but are not final; they are read only through lib/loader/format.ts
//   so a rename stays local.
// - Fields marked "not in contract, pending Sachintha" are UI needs the
//   contract does not cover yet. They stay optional.
// - Times are ISO datetimes in UTC with a Z, shown in depot time
//   (Asia/Colombo) by lib/loader/format.ts. Delivery windows are
//   "HH:MM:SS" in depot time and shown as-is.
// - Client-only UI state (SyncState) stays camelCase.

// ---- Shared enums (contract "Shared enums") ------------------------------

export type RunStatus =
  | "not_started"
  | "loading"
  | "issue_flagged"
  | "loaded"
  | "ready_to_depart"
  | "gated_out";

// to_load  – on the plan, not yet checked
// loaded   – checked onto the vehicle
// flagged  – shortage / damage / won't fit reported to the Dispatcher
// re_check – plan change touched it; must be checked again (a check clears it)
// take_off – plan change removed it after it was loaded; unload it
// moved    – moved off this run (other vehicle or deferred), nothing to do
// new      – added in the latest plan version, not yet checked
export type OrderState =
  | "to_load"
  | "loaded"
  | "flagged"
  | "re_check"
  | "take_off"
  | "moved"
  | "new";

export type TemperatureClass = "chilled" | "ambient";
export type Brand = "fresh" | "style" | "tech";
export type DockType = "rear_dock" | "street" | "mall_bay";
export type VehicleType = "truck" | "van";
export type TempCapability = "reefer" | "ambient";
export type IssueType = "missing" | "short" | "damaged" | "wont_fit";
export type IssueStatus = "sent" | "seen" | "decided" | "default_applied";
export type ChangeKind = "unload_from_truck" | "dont_load" | "load_new" | "resequence";
export type ActorKind = "loader" | "dispatcher" | "system";
/** Not in the enum table; only "night" appears in the contract examples. */
export type Wave = "night" | "day";

// ---- Built (L0): GET /loader/runs/{code} ---------------------------------

export interface Vehicle {
  code: string;
  vehicle_type: VehicleType;
  temp_capability: TempCapability;
  max_weight_kg: number;
  max_volume_m3: number;
}

export interface Outlet {
  code: string;
  name: string;
  brand: Brand;
  district: string;
  dock_type: DockType;
  van_only: boolean;
  /** "HH:MM:SS" */
  window_start: string;
  /** "HH:MM:SS" */
  window_end: string;
}

export interface RunOrder {
  order_number: string;
  temperature_class: TemperatureClass;
  units: number;
  weight_kg: number;
  volume_m3: number;
  state: OrderState;
  checked_at: string | null;
  checked_by: string | null;
  /** Not in contract, pending Sachintha: units loaded when fewer than ordered. */
  loaded_units?: number;
  /** Not in contract, pending Sachintha: one-line note under the order. */
  note?: string;
  /** Not in contract, pending Sachintha: plan version that last changed it. */
  changed_in_version?: number;
  /** Not in contract, pending Sachintha: where a moved order went. */
  moved_to?: string;
}

export interface RunStop {
  /** Driver's route order: 1 is delivered first. */
  stop_sequence: number;
  /** Load order: 1 is loaded first (deepest, by the cab). */
  load_position: number;
  eta: string;
  handling_minutes: number;
  /** Values are not listed in the contract ("pending" in the example). */
  status: string;
  outlet: Outlet;
  orders: RunOrder[];
  /** Not in contract, pending Sachintha: note after the ETA line. */
  note?: string;
  /** Not in contract, pending Sachintha: stop added in the current plan. */
  is_new?: boolean;
}

export interface RunCapacity {
  loaded_weight_kg: number;
  planned_weight_kg: number;
  max_weight_kg: number;
  loaded_volume_m3: number;
  planned_volume_m3: number;
  max_volume_m3: number;
}

export interface RunPlan {
  version: number;
  published_at: string;
  source: string;
  summary: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

/** RunDetailRead. Stops come ordered by load_position. */
export interface Run {
  code: string;
  trip_number: number;
  brand: Brand;
  district: string;
  wave: Wave;
  departs_at: string;
  status: RunStatus;
  current_plan_version: number;
  dock: string;
  vehicle: Vehicle;
  capacity: RunCapacity;
  plan: RunPlan;
  /** Set while a newer plan waits to be acknowledged; release stays locked. */
  unacknowledged_plan_version: number | null;
  stops: RunStop[];
  /** Counts loaded and flagged; re_check does not count. */
  orders_checked: number;
  /** Excludes take_off and moved. */
  orders_total: number;
}

// ---- Built (L0): activity and issues -------------------------------------

export interface ActivityEntry {
  at: string;
  run_code: string;
  actor_kind: ActorKind;
  actor: string;
  event_type: string;
  order_number: string | null;
  message: string;
}

export interface IssueOption {
  label: string;
  detail: string;
  is_default: boolean;
  is_chosen: boolean;
}

/** IssueDetailRead. */
export interface LoaderIssue {
  id: number;
  run_code: string;
  order_number: string;
  outlet_code: string;
  issue_type: IssueType;
  units_affected: number;
  units_total: number;
  quick_note_tag: string | null;
  note: string | null;
  photo_path: string | null;
  reported_by: string;
  reported_at: string;
  status: IssueStatus;
  seen_at: string | null;
  decide_by: string;
  decided_at: string | null;
  decided_by: string | null;
  options: IssueOption[];
}

// ---- Proposed (L2, L3): users, session, queue, summary -------------------

export interface LoaderUser {
  id: number;
  full_name: string;
  short_name: string;
}

export interface LoaderSession {
  session_id: number;
  loader: { id: number; short_name: string };
  dock: string;
  depot: string;
  started_at: string;
}

export type RunAlertTone = "warning" | "error" | "success" | "neutral";

export interface RunAlert {
  tone: RunAlertTone;
  message: string;
  action: string;
  href: string;
}

export interface RunSummary {
  code: string;
  vehicle_code: string;
  vehicle_type: VehicleType;
  temp_capability: TempCapability;
  trip_number: number;
  brand: Brand;
  district: string;
  departs_at: string;
  status: RunStatus;
  stop_count: number;
  orders_checked: number;
  orders_total: number;
  loader: string | null;
  /** Display strings, e.g. ["Truck", "Reefer", "5,510 kg · 26.4 m³"]. */
  chips: string[];
  alert: RunAlert | null;
}

export interface RunGroup {
  label: string;
  brand: Brand;
  wave: Wave;
  runs: RunSummary[];
}

export interface RunQueue {
  groups: RunGroup[];
}

export interface QueueSummary {
  dock: string;
  date: string;
  day_label: string;
  next_holiday: { date: string; label: string } | null;
  runs: number;
  loading: { count: number; loaders: string[] };
  issues: { count: number; label: string };
  ready: { count: number; run_codes: string[] };
}

// ---- Offline writes -------------------------------------------------------

export type QueuedActionType =
  | "check"
  | "uncheck"
  | "unload"
  | "flag"
  | "acknowledge"
  | "release"
  | "release_undo";

/**
 * Offline write, stored in IndexedDB. client_action_id (crypto.randomUUID())
 * is generated once per tap and sent in the JSON body; the server answers a
 * replayed id with the original result and 200, so retries are safe.
 */
export interface QueuedAction {
  client_action_id: string;
  action_type: QueuedActionType;
  run_code: string;
  payload: QueuedActionPayload;
  /** Plan version on screen when tapped (used by acknowledge). */
  plan_version: number;
  created_at: string;
  attempts: number;
  /** Client-only: pending until sent; conflict (409) and failed are not retried. */
  status: QueuedActionStatus;
  last_error?: string;
}

export type QueuedActionStatus = "pending" | "conflict" | "failed";

/**
 * Every write carries the loader session (optional on the server until L2
 * sign-in exists, then required).
 */
export interface SessionPayload {
  loader_session_id: number;
}

/** check / uncheck / unload. */
export interface OrderActionPayload extends SessionPayload {
  order_number: string;
}

/** POST /loader/issues body (minus client_action_id). */
export interface FlagActionPayload extends SessionPayload {
  run_code: string;
  order_number: string;
  issue_type: IssueType;
  units_affected: number;
  quick_note_tag: string | null;
  note: string;
}

/** acknowledge / release / release_undo: session only. */
export type QueuedActionPayload = OrderActionPayload | FlagActionPayload | SessionPayload;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** What a screen passes when it acts; the session is added by the outbox hook. */
export type ActionInput = DistributiveOmit<QueuedActionPayload, "loader_session_id">;

/** Client-only connectivity and outbox state (not an API shape). */
export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  failed: number;
  lastSyncedAt?: string;
}
