// Loader module types.
// API and mock data shapes are snake_case, using the enum values confirmed for
// the /loader API (L0). docs/loader/API_CONTRACT.md is the final source once it lands.
// Client-only UI state (SyncState) stays camelCase.

export type Brand = "fresh" | "style" | "tech";
export type TemperatureClass = "chilled" | "ambient";
export type DockType = "rear_dock" | "street" | "mall_bay";
export type VehicleType = "truck" | "van";

// A run waiting on the Dispatcher stays issue_flagged; the waiting state comes
// from its issue status (sent / seen).
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
// re_check – plan change touched it; must be checked again
// take_off – plan change removed it after it was loaded; unload it
// moved    – moved off this run (other vehicle or deferred), nothing to do
// new      – added in the latest plan version, not yet checked
export type LoadState =
  | "to_load"
  | "loaded"
  | "flagged"
  | "re_check"
  | "take_off"
  | "moved"
  | "new";

export type IssueType = "missing" | "short" | "damaged" | "wont_fit";
export type IssueStatus = "sent" | "seen" | "decided" | "default_applied";

export interface LoaderUser {
  user_id: string;
  full_name: string;
  initials: string;
  depot: string;
}

export interface LoaderDock {
  dock_code: string;
  name: string;
  depot: string;
}

export interface Vehicle {
  vehicle_code: string;
  vehicle_type: VehicleType;
  is_reefer: boolean;
  max_weight_kg: number;
  max_volume_m3: number;
}

export interface Outlet {
  outlet_code: string;
  brand: Brand;
  dock_type: DockType;
  /** Delivery window, local time "HH:mm". */
  window_start: string;
  window_end: string;
  van_only: boolean;
}

export interface RunOrder {
  order_number: string;
  outlet_code: string;
  temperature_class: TemperatureClass;
  units: number;
  weight_kg: number;
  volume_m3: number;
  load_state: LoadState;
  checked_at?: string;
  checked_by?: string;
  /** Units actually loaded when fewer than ordered (agreed short). */
  loaded_units?: number;
  /** One-line status shown under the order, e.g. "Deferred to Fri 29 May". */
  note?: string;
  /** Plan version that last changed this order. */
  changed_in_version?: number;
}

export interface RunStop {
  /** Delivery order: 1 is delivered first. */
  stop_sequence: number;
  /** Load order: 1 is loaded first (deepest, by the cab). */
  load_position: number;
  outlet: Outlet;
  eta: string;
  orders: RunOrder[];
  note?: string;
  /** Stop added in the current plan version. */
  is_new?: boolean;
}

export interface Run {
  run_code: string;
  trip_number: number;
  vehicle: Vehicle;
  brand: Brand;
  area: string;
  departs_at: string;
  status: RunStatus;
  plan_version: number;
  plan_updated_at: string;
  acknowledged_plan_version?: number;
  acknowledged_by?: string;
  acknowledged_at?: string;
  stops: RunStop[];
  loading_by?: string[];
  signed_off_by?: string;
  signed_off_at?: string;
}

/** Provisional until API_CONTRACT.md defines the issue shape. */
export interface LoaderIssue {
  issue_id: string;
  run_code: string;
  order_number: string;
  issue_type: IssueType;
  status: IssueStatus;
  units_affected?: number;
  note?: string;
  reported_by: string;
  reported_at: string;
  decide_by?: string;
}

export type QueuedActionType =
  | "check"
  | "uncheck"
  | "unload"
  | "recheck"
  | "flag"
  | "acknowledge"
  | "release";

/**
 * Offline write, stored in IndexedDB. client_action_id (crypto.randomUUID())
 * is sent in the JSON body; replaying it returns the original result, so
 * retries are safe.
 */
export interface QueuedAction {
  client_action_id: string;
  action_type: QueuedActionType;
  run_code: string;
  payload: QueuedActionPayload;
  plan_version: number;
  created_at: string;
  attempts: number;
  /** Client-only: pending until sent; conflict (409) and failed are not retried. */
  status: QueuedActionStatus;
  last_error?: string;
}

export type QueuedActionStatus = "pending" | "conflict" | "failed";

/** Order-level writes: check, uncheck, unload, recheck. */
export interface OrderActionPayload {
  order_number: string;
}

export interface FlagActionPayload {
  order_number: string;
  issue_type: IssueType;
  units_affected?: number;
  note?: string;
}

export type QueuedActionPayload =
  | OrderActionPayload
  | FlagActionPayload
  | Record<string, never>;

/** Client-only connectivity and outbox state (not an API shape). */
export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  failed: number;
  lastSyncedAt?: string;
}
