"use client";

import * as React from "react";
import { useStoredSession } from "@/components/loader/loader-session";
import { useLoaderSync } from "@/components/loader/loader-sync-provider";
import { cachedQueue, loadQueue, withLocalRuns, type QueueSource } from "@/lib/loader/offline/queue-cache";
import type { QueueSummary, RunQueue } from "@/lib/loader/types";

/** How often the queue is refetched while it is open. */
const REFRESH_MS = 30_000;

export type LiveQueue =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; queue: RunQueue; summary: QueueSummary; fetchedAt: string; source: QueueSource };

/**
 * The signed-in dock's queue (GET /loader/runs, /loader/summary): this
 * tablet's last copy at once, then the server's. Refetched after each sync,
 * when the tab comes back, and every 30 s, so plan-change and issue alerts
 * show without a reload. Offline it keeps the last copy.
 */
export function useLiveQueue(): LiveQueue {
  const { transport, sync } = useLoaderSync();
  const dock = useStoredSession()?.session.dock;
  const [state, setState] = React.useState<LiveQueue>({ status: "loading" });
  // Only the newest load may update the screen.
  const seq = React.useRef(0);

  const refresh = React.useCallback(async () => {
    if (!dock) return;
    const mine = ++seq.current;
    const loaded = await loadQueue(transport, dock);
    const queue = loaded && (await withLocalRuns(loaded.queue));
    if (mine !== seq.current) return;
    if (!loaded || !queue) {
      setState((s) => (s.status === "ready" ? s : { status: "unavailable" }));
      return;
    }
    setState({ status: "ready", queue, summary: loaded.summary, fetchedAt: loaded.fetched_at, source: loaded.source });
  }, [transport, dock]);

  // The last copy first, so the queue shows at once, even offline.
  React.useEffect(() => {
    if (!dock) return;
    let cancelled = false;
    void cachedQueue(dock).then(async (cached) => {
      if (cancelled || !cached) return;
      const queue = await withLocalRuns(cached.queue);
      setState((s) =>
        s.status === "ready"
          ? s
          : { status: "ready", queue, summary: cached.summary, fetchedAt: cached.fetched_at, source: "cache" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [dock]);

  // After each sync (and when the pending count changes, for the local counts).
  // Scheduled as a callback, like the sync provider's first check.
  React.useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh, sync.lastSyncedAt, sync.pending]);

  React.useEffect(() => {
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return state;
}
