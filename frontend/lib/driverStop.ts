/**
 * Stop detail for the driver's at-stop screens (arrived → outcome → proof).
 * Backed by GET /driver/stops/{id}, which includes the order being delivered.
 */
import { apiFetch } from "./api";
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

export function fetchStopDetail(stopId: string | number) {
  return apiFetch<StopDetail>(`/driver/stops/${stopId}`);
}

/** "05:00-07:30" → { open: "05:00", close: "07:30" } */
export function parseWindow(window: string | null | undefined) {
  const [open, close] = (window ?? "").split("-").map((s) => s.trim());
  return { open: open || null, close: close || null };
}
