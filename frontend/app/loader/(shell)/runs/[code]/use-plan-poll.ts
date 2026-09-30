"use client";

// How an open checklist learns that the Dispatcher published a new plan.
//
// Web push is not set up yet (PWA-0 has no VAPID keys), so the checklist polls
// GET /loader/runs/{code} every 15 s while it is on screen and the tablet is
// online, and at once when the tab comes back into view or the outbox reports a
// refused write (a 409 usually means the plan moved on). The sync provider's
// own refresh after each flush still runs; this is only faster, and only here.
// When push lands, this hook is the one piece to replace.

import * as React from "react";
import { useLoaderSync } from "@/components/loader/loader-sync-provider";
import type { Run } from "@/lib/loader/types";

const POLL_MS = 15_000;

/**
 * Calls onNewPlan with the server's run when its plan differs from the one on
 * screen: a newer version, or a different acknowledgement (another tablet
 * acknowledged it). Anything else is left to the sync provider.
 */
export function usePlanPoll(run: Run, onNewPlan: (fresh: Run) => void) {
  const { transport, sync } = useLoaderSync();
  const shown = React.useRef(run);

  React.useEffect(() => {
    shown.current = run;
  }, [run]);

  const poll = React.useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    let fresh: Run | undefined;
    try {
      fresh = await transport.fetchRun(shown.current.code);
    } catch {
      return; // Unreachable: try again on the next tick.
    }
    const current = shown.current;
    if (
      fresh &&
      (fresh.current_plan_version !== current.current_plan_version ||
        fresh.unacknowledged_plan_version !== current.unacknowledged_plan_version)
    ) {
      onNewPlan(fresh);
    }
  }, [transport, onNewPlan]);

  React.useEffect(() => {
    if (!sync.online) return;
    const id = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sync.online, poll]);

  // A refused write (conflict or failure) is the likeliest sign of a new plan.
  React.useEffect(() => {
    if (sync.online && sync.failed > 0) void poll();
  }, [sync.online, sync.failed, poll]);
}
