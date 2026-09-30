"use client";

import * as React from "react";
import { useLoaderSync } from "@/components/loader/loader-sync-provider";
import { cachedActivity, loadActivity, type ActivitySource } from "@/lib/loader/offline/activity-cache";
import type { ActivityEntry } from "@/lib/loader/types";

/** How often the log is refetched while it is open. */
const REFRESH_MS = 30_000;

export type RunActivity =
  | { status: "loading" }
  | { status: "not_found" }
  | { status: "unavailable" }
  | { status: "ready"; events: ActivityEntry[]; fetchedAt: string; source: ActivitySource };

/**
 * One run's log (GET /loader/runs/{code}/activity), newest first: this
 * tablet's last copy at once, then the server's. Refetched after each sync
 * (so a tap joins the log once the server has it), when the tab comes back,
 * and every 30 s. Offline it keeps the last copy.
 */
export function useRunActivity(code: string): RunActivity {
  const { transport, sync } = useLoaderSync();
  const [state, setState] = React.useState<RunActivity>({ status: "loading" });
  // Only the newest load may update the screen.
  const seq = React.useRef(0);

  const refresh = React.useCallback(async () => {
    const mine = ++seq.current;
    const loaded = await loadActivity(transport, code);
    if (mine !== seq.current) return;
    if (loaded.kind === "ok") {
      setState({ status: "ready", events: loaded.events, fetchedAt: loaded.fetchedAt, source: loaded.source });
    } else {
      // Keep a copy already on screen rather than blanking it.
      setState((s) => (s.status === "ready" ? s : { status: loaded.kind }));
    }
  }, [transport, code]);

  // The last copy first, so the log shows at once, even offline.
  React.useEffect(() => {
    let cancelled = false;
    void cachedActivity(code).then((cached) => {
      if (cancelled || !cached) return;
      setState((s) =>
        s.status === "ready" ? s : { status: "ready", events: cached.events, fetchedAt: cached.fetched_at, source: "cache" },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  // After each sync, and when the pending count changes.
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
