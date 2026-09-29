// Loads one run for the checklist through the loader transport, so reads use
// the same switch (mock or API) and base URL as the offline outbox's writes.
// Runs come back in the API shape (RunDetailRead, lib/loader/types.ts): no
// adapting here.

import { getCachedRun } from "@/lib/loader/offline/db";
import { NetworkError, type Transport } from "@/lib/loader/offline/transport";
import type { Run } from "@/lib/loader/types";

export type LoadResult =
  | { kind: "ok"; run: Run }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/**
 * The run from the server, or this tablet's cached copy when the server
 * cannot be reached. useOfflineRun takes it from there (server copy vs local
 * copy with pending actions).
 */
export async function loadRun(code: string, transport: Transport): Promise<LoadResult> {
  try {
    const run = await transport.fetchRun(code);
    return run ? { kind: "ok", run } : { kind: "not_found" };
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
  }
  try {
    const cached = await getCachedRun(code);
    if (cached) return { kind: "ok", run: cached };
  } catch {
    // No IndexedDB: nothing cached.
  }
  return { kind: "unavailable" };
}

/**
 * orders_loaded: "loaded" orders only (not flagged, not re_check), out of the
 * active orders - the contract's rule. The API sends it, but lib/loader's Run
 * type does not have the field yet and the outbox's local recompute does not
 * maintain it, so it is counted from the rows; that is the same rule, and it
 * follows taps made before they sync.
 */
export function ordersLoaded(run: Run): number {
  let loaded = 0;
  for (const stop of run.stops) {
    for (const order of stop.orders) {
      if (order.state === "loaded") loaded += 1;
    }
  }
  return loaded;
}
