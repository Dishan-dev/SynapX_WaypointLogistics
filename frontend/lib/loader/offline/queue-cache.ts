// The loading queue for this tablet's dock: GET /loader/runs and /summary,
// kept in IndexedDB so the queue opens offline. Runs with actions still
// waiting to sync show this tablet's own counts, like the checklist does.

import { planChangeAlert } from "../format";
import type { Run, RunQueue } from "../types";
import { getCachedQueue, getCachedRun, putCachedQueue, type CachedQueue } from "./db";
import { pendingCount } from "./run-cache";
import { NetworkError, type Transport } from "./transport";

export type QueueSource = "server" | "cache";

export interface LoadedQueue extends CachedQueue {
  source: QueueSource;
}

/** Fired on window after a fresh queue is loaded; detail is the CachedQueue. */
export const QUEUE_EVENT = "waypoint-loader-queue";

/** This tablet's last copy of the dock's queue. */
export async function cachedQueue(dock: string): Promise<CachedQueue | undefined> {
  try {
    return await getCachedQueue(dock);
  } catch {
    return undefined; // No IndexedDB: nothing kept.
  }
}

/**
 * The dock's queue from the server, or this tablet's last copy when the
 * server cannot be reached. Undefined when there is neither.
 */
export async function loadQueue(transport: Transport, dock: string): Promise<LoadedQueue | undefined> {
  try {
    const [queue, summary] = await Promise.all([transport.fetchQueue(dock), transport.fetchSummary(dock)]);
    const entry: CachedQueue = { dock, queue, summary, fetched_at: new Date().toISOString() };
    try {
      await putCachedQueue(entry);
    } catch {
      // No IndexedDB: the queue still shows, it just is not kept.
    }
    window.dispatchEvent(new CustomEvent<CachedQueue>(QUEUE_EVENT, { detail: entry }));
    return { ...entry, source: "server" };
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    const cached = await cachedQueue(dock);
    return cached && { ...cached, source: "cache" };
  }
}

async function localRun(code: string): Promise<Run | undefined> {
  try {
    return await getCachedRun(code);
  } catch {
    return undefined;
  }
}

/**
 * The queue as this tablet sees it: a run with actions waiting to sync takes
 * its status and counts from the tablet's copy, so "5 of 8 loaded" does not
 * jump back until they are sent, and shows the plan-change alert when that
 * copy has a plan nobody has acknowledged (Figma 2c #1). Other runs are shown
 * as the server sent them; the server builds their alerts.
 */
export async function withLocalRuns(queue: RunQueue): Promise<RunQueue> {
  const groups = await Promise.all(
    queue.groups.map(async (group) => ({
      ...group,
      runs: await Promise.all(
        group.runs.map(async (card) => {
          if ((await pendingCount(card.code)) === 0) return card;
          const run = await localRun(card.code);
          if (!run) return card;
          return {
            ...card,
            status: run.status,
            orders_loaded: run.orders_loaded,
            orders_checked: run.orders_checked,
            orders_total: run.orders_total,
            // The tablet's copy decides the plan alert (warning tone, per the
            // contract); other alerts (issues, sign-off) stay the server's.
            alert: planChangeAlert(run) ?? (card.alert?.tone === "warning" ? null : card.alert),
          };
        }),
      ),
    })),
  );
  return { groups };
}
