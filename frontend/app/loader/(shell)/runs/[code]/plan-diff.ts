// The L7 fields on GET /loader/runs/{code} (API_CONTRACT.md: "Plan diff" and
// "Release lock"). lib/loader's Run type does not carry them yet, so they are
// typed here and read through these helpers; when the shared types gain them,
// only this file changes.

import { formatDay, formatTime } from "@/lib/loader/format";
import type { ChangeKind, Run, RunOrder } from "@/lib/loader/types";

export interface MovedTo {
  run_code: string | null;
  vehicle_code: string;
  trip_number: number;
  departs_at: string | null;
}

/** A checklist row as the API sends it, diff fields included. */
export interface DiffOrder extends Omit<RunOrder, "note" | "moved_to" | "changed_in_version"> {
  changed_in_version?: number | null;
  change_kind?: ChangeKind | null;
  note?: string | null;
  reason?: string | null;
  moved_to?: MovedTo | null;
  deferred_to?: string | null;
  unloaded_at?: string | null;
  unloaded_by?: string | null;
}

export interface PlanChange {
  from_version: number;
  to_version: number;
  published_at: string;
  summary: string | null;
  planned_weight_before_kg: number;
  planned_weight_after_kg: number;
  planned_volume_before_m3: number;
  planned_volume_after_m3: number;
  checks_saved: number;
  was_ready_at: string | null;
}

export type ReleaseBlockerCode =
  | "plan_not_acknowledged"
  | "unload_pending"
  | "re_check_pending"
  | "orders_open"
  | "issue_waiting";

export interface ReleaseBlocker {
  code: ReleaseBlockerCode;
  count: number;
}

interface DiffRunFields {
  acknowledged_plan_version?: number | null;
  plan_change?: PlanChange | null;
  release_blockers?: ReleaseBlocker[];
}

export function planChange(run: Run): PlanChange | undefined {
  return (run as Run & DiffRunFields).plan_change ?? undefined;
}

export function diffOrder(order: RunOrder): DiffOrder {
  return order as unknown as DiffOrder;
}

/** "2026-05-29" -> "Fri 29 May", read as a depot-calendar date. */
function formatDate(day: string): string {
  return formatDay(`${day}T00:00:00`);
}

/**
 * The line under a row, built from the diff fields. The API keeps its notes
 * time-free, so times (off truck 02:24, departs 03:45) are added here, in
 * depot time. Rows the plan change did not touch keep the default line.
 *
 * Works from the row's state as well as the diff, so a row changed locally
 * before the server confirms (an unload tapped offline) still reads right.
 */
export function rowNote(raw: RunOrder): string | undefined {
  const order = diffOrder(raw);
  const deferred = order.deferred_to ? `deferred to ${formatDate(order.deferred_to)}` : undefined;

  if (order.state === "take_off") {
    return deferred ? `Take off · ${deferred}` : (order.note ?? "Take off the truck");
  }
  if (order.state === "moved") {
    if (order.moved_to) {
      const { vehicle_code, trip_number, departs_at } = order.moved_to;
      return [`Moved to ${vehicle_code}`, `Trip ${trip_number}`, departs_at && formatTime(departs_at)]
        .filter(Boolean)
        .join(" · ");
    }
    if (order.change_kind === "unload_from_truck") {
      const back = order.temperature_class === "chilled" ? "chiller" : "staging";
      const offAt = order.unloaded_at ? `off truck ${formatTime(order.unloaded_at)}` : "off truck";
      return deferred
        ? `${deferred[0].toUpperCase()}${deferred.slice(1)} · ${offAt}`
        : `${offAt[0].toUpperCase()}${offAt.slice(1)} · back in ${back}`;
    }
    if (deferred) return `${deferred[0].toUpperCase()}${deferred.slice(1)}`;
    return undefined;
  }
  if (order.state === "re_check") return order.note ?? "Re-check · plan changed";
  return undefined;
}

/**
 * The row as OrderRow expects it (lib/loader's RunOrder): the composed note,
 * and nulls turned into "absent" so a missing version never reads "vnull".
 */
export function displayOrder(raw: RunOrder): RunOrder {
  const order = diffOrder(raw);
  return {
    ...raw,
    note: rowNote(raw),
    moved_to: undefined,
    changed_in_version: order.changed_in_version ?? undefined,
  };
}
