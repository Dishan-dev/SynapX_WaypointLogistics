/**
 * Stop detail for the driver's at-stop screens (arrived → outcome → proof).
 * Backed by GET /driver/stops/{id}, which includes the order being delivered.
 */
import { apiFetch, ApiError } from "./api";
import type { DeliveryStop, TripStatus } from "@/types/driver-map";

export interface StopOrderItem {
  sku: string;
  item_name: string;
  quantity: number;
}

export interface StopOrderInfo {
  order_number: string;
  brand: string | null;
  temperature_zone: string | null;
  delivery_window: string | null;
  units: number | null;
  weight_kg: number | null;
  volume_m3: number | null;
  notes: string | null;
  /** False when the order is on the plan but the loader didn't load it. */
  on_truck?: boolean;
  items: StopOrderItem[];
}

export interface StopDetail extends DeliveryStop {
  total_stops: number;
  trip_status: TripStatus;
  /** The first of `orders`. */
  order: StopOrderInfo | null;
  /** Every order dropped at this stop (a Fresh outlet can get a dry and a chilled one). */
  orders?: StopOrderInfo[];
  pod: { id: number; recipient_name: string } | null;
}

/**
 * A stop the driver still has to finish: not reached yet, or marked delivered /
 * partial but its proof isn't saved (they went back from the proof screen).
 * A failed stop is closed by its outcome and the issue report.
 */
export function isStopOpen(stop: { status: string; completed_at: string | null }) {
  if (stop.status === "pending" || stop.status === "arrived") return true;
  return (stop.status === "delivered" || stop.status === "partial") && !stop.completed_at;
}

// The last copy of each stop seen online, so the at-stop screens still open
// with no signal. The map saves every stop of the trip while it has signal.
const CACHE_PREFIX = "driver-stop:";

function cacheStop(detail: StopDetail) {
  try {
    localStorage.setItem(CACHE_PREFIX + detail.id, JSON.stringify(detail));
  } catch {
    // storage full or blocked: the screens just need signal
  }
}

export function getCachedStop(stopId: string | number): StopDetail | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + stopId);
    return raw ? (JSON.parse(raw) as StopDetail) : null;
  } catch {
    return null;
  }
}

// The trip under way, so an SOS sent with no signal still names it
const ACTIVE_TRIP_KEY = "driver-active-trip";

export function rememberActiveTrip(tripId: number | null) {
  try {
    if (tripId === null) localStorage.removeItem(ACTIVE_TRIP_KEY);
    else localStorage.setItem(ACTIVE_TRIP_KEY, String(tripId));
  } catch {
    // storage blocked: the SOS goes without a trip
  }
}

export function getRememberedTrip(): number | null {
  try {
    const value = localStorage.getItem(ACTIVE_TRIP_KEY);
    return value ? Number(value) : null;
  } catch {
    return null;
  }
}

/** After an action is saved offline, so the next screen shows the stop as it will be. */
export function updateCachedStop(stopId: string | number, changes: Partial<StopDetail>) {
  const stop = getCachedStop(stopId);
  if (stop) cacheStop({ ...stop, ...changes });
}

export async function fetchStopDetail(stopId: string | number) {
  try {
    const detail = await apiFetch<StopDetail>(`/driver/stops/${stopId}`);
    cacheStop(detail);
    return detail;
  } catch (err) {
    const cached = err instanceof ApiError && err.isNetworkError ? getCachedStop(stopId) : null;
    if (cached) return cached;
    throw err;
  }
}

/** "05:00-07:30" → { open: "05:00", close: "07:30" } */
export function parseWindow(window: string | null | undefined) {
  const [open, close] = (window ?? "").split("-").map((s) => s.trim());
  return { open: open || null, close: close || null };
}
