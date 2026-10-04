// The Queue tab's new-arrivals badge: runs whose truck reached a dock (stage
// at_dock, nobody on them yet) since this loader last had the queue open.
// What the queue showed is kept per tablet session in localStorage; there is
// no server push, the count comes from the queue copies this tablet loads.

import type { RunQueue } from "./types";

const SEEN_KEY = "waypoint-loader-queue-seen";

interface SeenArrivals {
  session_id: number;
  /** The at_dock runs on screen when the queue was last open. */
  codes: string[];
}

/** The runs in this queue waiting at a dock for a loader to pick them. */
export function atDockCodes(queue: RunQueue): string[] {
  return queue.docks.flatMap((dock) => dock.runs.filter((run) => run.stage === "at_dock").map((run) => run.code));
}

function readSeen(sessionId: number): Set<string> | undefined {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const seen = raw ? (JSON.parse(raw) as SeenArrivals) : undefined;
    return seen?.session_id === sessionId ? new Set(seen.codes) : undefined;
  } catch {
    return undefined;
  }
}

/** The queue is open: everything waiting on it now has been seen. */
export function markArrivalsSeen(sessionId: number, queue: RunQueue): void {
  try {
    const seen: SeenArrivals = { session_id: sessionId, codes: atDockCodes(queue) };
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Storage blocked: the badge counts from sign-in again after a reload.
  }
}

/**
 * Runs at a dock that were not on the queue when this session last opened it.
 * A session that has not opened the queue yet counts every waiting run.
 */
export function newArrivalCount(sessionId: number, queue: RunQueue): number {
  const seen = readSeen(sessionId) ?? new Set<string>();
  return atDockCodes(queue).filter((code) => !seen.has(code)).length;
}
