// One run's activity log (GET /loader/runs/{code}/activity), kept in
// IndexedDB so the Log tab and the checklist's Change log open offline.
// Like the queue, it is the server's log: taps still waiting to sync show on
// the checklist, and join the log once the server has them.

import type { ActivityEntry } from "../types";
import { getCachedActivity, putCachedActivity, type CachedActivity } from "./db";
import { NetworkError, type Transport } from "./transport";

export type ActivitySource = "server" | "cache";

export type LoadedActivity =
  | { kind: "ok"; events: ActivityEntry[]; fetchedAt: string; source: ActivitySource }
  | { kind: "not_found" }
  | { kind: "unavailable" };

/** This tablet's last copy of the run's log. */
export async function cachedActivity(runCode: string): Promise<CachedActivity | undefined> {
  try {
    return await getCachedActivity(runCode);
  } catch {
    return undefined; // No IndexedDB: nothing kept.
  }
}

/**
 * The run's log from the server, newest first, or this tablet's last copy
 * when the server cannot be reached.
 */
export async function loadActivity(transport: Transport, runCode: string): Promise<LoadedActivity> {
  try {
    const events = await transport.fetchActivity(runCode);
    if (!events) return { kind: "not_found" };
    const entry: CachedActivity = { run_code: runCode, events, fetched_at: new Date().toISOString() };
    try {
      await putCachedActivity(entry);
    } catch {
      // No IndexedDB: the log still shows, it just is not kept.
    }
    return { kind: "ok", events, fetchedAt: entry.fetched_at, source: "server" };
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    const cached = await cachedActivity(runCode);
    return cached
      ? { kind: "ok", events: cached.events, fetchedAt: cached.fetched_at, source: "cache" }
      : { kind: "unavailable" };
  }
}
