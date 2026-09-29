// Loads one run for the checklist and turns GET /loader/runs/{code}
// (RunDetailRead, docs/loader/API_CONTRACT.md) into the Run shape the loader
// components and offline outbox work with. Vehicle limits keep their API names
// (max_weight_kg, max_volume_m3), so the page does not change when the vehicles
// table is merged with the dispatcher's.

import { findMockRun } from "@/lib/loader/mock-data";
import { getCachedRun } from "@/lib/loader/offline/db";
import type {
  Brand,
  DockType,
  LoadState,
  Run,
  RunStatus,
  TemperatureClass,
  VehicleType,
} from "@/lib/loader/types";

// Same switch and base URL as the outbox transport, so reads and writes always
// go to the same place.
const USE_API = process.env.NEXT_PUBLIC_LOADER_TRANSPORT === "api";
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// The API sends naive times in depot time ("2026-05-28T03:30:00"). The loader
// formatters render in Asia/Colombo, so pin the offset before they parse it.
const DEPOT_OFFSET = "+05:30";

interface RunDetailRead {
  code: string;
  trip_number: number;
  brand: Brand;
  district: string;
  departs_at: string;
  status: RunStatus;
  current_plan_version: number;
  vehicle: {
    code: string;
    vehicle_type: VehicleType;
    temp_capability: "reefer" | "ambient";
    max_weight_kg: number;
    max_volume_m3: number;
  };
  plan: {
    version: number;
    published_at: string;
    acknowledged_at: string | null;
    acknowledged_by: string | null;
  } | null;
  stops: {
    stop_sequence: number;
    load_position: number;
    eta: string | null;
    outlet: {
      code: string;
      brand: Brand;
      dock_type: DockType;
      van_only: boolean;
      window_start: string | null;
      window_end: string | null;
    };
    orders: {
      order_number: string;
      temperature_class: TemperatureClass | null;
      units: number | null;
      weight_kg: number | null;
      volume_m3: number | null;
      state: LoadState;
      checked_at: string | null;
      checked_by: string | null;
    }[];
  }[];
}

export type LoadResult =
  | { kind: "ok"; run: Run; offline: boolean }
  | { kind: "not_found" }
  | { kind: "unavailable" };

function depotTime(iso: string): string;
function depotTime(iso: string | null): string | undefined;
function depotTime(iso: string | null): string | undefined {
  if (!iso) return undefined;
  return /(Z|[+-]\d\d:\d\d)$/.test(iso) ? iso : `${iso}${DEPOT_OFFSET}`;
}

/** "05:00:00" -> "05:00" */
function hhmm(time: string | null): string {
  return time ? time.slice(0, 5) : "";
}

export function runFromApi(detail: RunDetailRead): Run {
  const plan = detail.plan;
  const acknowledged = plan?.acknowledged_at ? plan : undefined;
  return {
    run_code: detail.code,
    trip_number: detail.trip_number,
    vehicle: {
      vehicle_code: detail.vehicle.code,
      vehicle_type: detail.vehicle.vehicle_type,
      is_reefer: detail.vehicle.temp_capability === "reefer",
      max_weight_kg: detail.vehicle.max_weight_kg,
      max_volume_m3: detail.vehicle.max_volume_m3,
    },
    brand: detail.brand,
    area: detail.district,
    departs_at: depotTime(detail.departs_at),
    status: detail.status,
    plan_version: detail.current_plan_version,
    plan_updated_at: depotTime(plan?.published_at ?? detail.departs_at),
    acknowledged_plan_version: acknowledged?.version,
    acknowledged_by: acknowledged?.acknowledged_by ?? undefined,
    acknowledged_at: depotTime(acknowledged?.acknowledged_at ?? null),
    stops: detail.stops.map((stop) => ({
      stop_sequence: stop.stop_sequence,
      load_position: stop.load_position,
      // A stop a plan change added has no ETA yet; the view shows it without one.
      eta: depotTime(stop.eta) ?? "",
      outlet: {
        outlet_code: stop.outlet.code,
        brand: stop.outlet.brand,
        dock_type: stop.outlet.dock_type,
        window_start: hhmm(stop.outlet.window_start),
        window_end: hhmm(stop.outlet.window_end),
        van_only: stop.outlet.van_only,
      },
      orders: stop.orders.map((order) => ({
        order_number: order.order_number,
        outlet_code: stop.outlet.code,
        temperature_class: order.temperature_class ?? "ambient",
        units: order.units ?? 0,
        weight_kg: order.weight_kg ?? 0,
        volume_m3: order.volume_m3 ?? 0,
        load_state: order.state,
        checked_at: depotTime(order.checked_at),
        checked_by: order.checked_by ?? undefined,
      })),
    })),
  };
}

async function cachedRun(code: string): Promise<LoadResult> {
  try {
    const run = await getCachedRun(code);
    return run ? { kind: "ok", run, offline: true } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

/**
 * The run from the API, falling back to this tablet's cached copy when the
 * server cannot be reached. Uses mock data when the outbox is on the mock
 * transport, so reads and writes stay on the same side.
 */
export async function loadRun(code: string): Promise<LoadResult> {
  if (!USE_API) {
    const run = findMockRun(code);
    return run ? { kind: "ok", run, offline: false } : { kind: "not_found" };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/loader/runs/${encodeURIComponent(code)}`, {
      cache: "no-store",
    });
  } catch {
    return cachedRun(code);
  }
  if (res.status === 404) return { kind: "not_found" };
  if (!res.ok) return cachedRun(code);
  return { kind: "ok", run: runFromApi((await res.json()) as RunDetailRead), offline: false };
}
