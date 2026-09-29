// Which copy of a run the screen shows: the server's or this tablet's.
//
// - Nothing pending for the run: the server copy wins, so other loaders'
//   checks, plan changes and server capacity show up. It replaces the cache.
// - Actions pending for the run: keep the local copy (server copy plus this
//   tablet's queued actions) until they sync; the next resolve after the sync
//   refetches the server copy.
// - Server unreachable and nothing pending: the cached copy, which is the last
//   server copy this tablet saw.

import type { Run } from "../types";
import { getCachedRun, listOutbox, putCachedRun } from "./db";
import { NetworkError, type Transport } from "./transport";

export type RunSource = "server" | "local" | "cache" | "initial";

export interface ResolvedRun {
  run: Run;
  source: RunSource;
}

/** Queued actions for this run that have not been sent yet. */
export async function pendingCount(runCode: string): Promise<number> {
  try {
    const outbox = await listOutbox();
    return outbox.filter((a) => a.run_code === runCode && a.status === "pending").length;
  } catch {
    return 0; // No IndexedDB: nothing can be queued.
  }
}

async function cached(code: string): Promise<Run | undefined> {
  try {
    return await getCachedRun(code);
  } catch {
    return undefined;
  }
}

async function remember(run: Run): Promise<void> {
  try {
    await putCachedRun(run);
  } catch {
    // No IndexedDB: nothing to keep.
  }
}

/**
 * Resolve the run to show. `initial` is the copy the page was rendered with;
 * it is used when neither the server nor the cache can supply one.
 */
export async function resolveRun(initial: Run, transport: Transport): Promise<ResolvedRun> {
  const code = initial.code;

  if ((await pendingCount(code)) > 0) {
    const local = await cached(code);
    return local ? { run: local, source: "local" } : { run: initial, source: "initial" };
  }

  try {
    const server = await transport.fetchRun(code);
    if (server) {
      await remember(server);
      return { run: server, source: "server" };
    }
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
  }

  // Offline with nothing pending: the newest copy this tablet has seen.
  const last = await cached(code);
  if (last && last.current_plan_version >= initial.current_plan_version) {
    return { run: last, source: "cache" };
  }
  await remember(initial);
  return { run: initial, source: "initial" };
}
