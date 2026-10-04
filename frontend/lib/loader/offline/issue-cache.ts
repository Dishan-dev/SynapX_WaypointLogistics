// One flagged issue (GET /loader/issues/{id}) for the L8 waiting / decision
// screen, with this tablet's last copy for offline use. An issue never opened
// here can still show offline from the Issues tab's last list of the depot.

import type { LoaderIssue } from "../types";
import { cachedIssues } from "./issues-cache";
import { NetworkError, type Transport } from "./transport";

const KEY_PREFIX = "waypoint-loader-issue:";

export type LoadedIssue =
  | { kind: "ok"; issue: LoaderIssue; fetchedAt: string; source: "server" | "cache" }
  | { kind: "not_found" }
  | { kind: "unavailable" };

interface CachedIssue {
  issue: LoaderIssue;
  fetchedAt: string;
}

function readCache(id: number): CachedIssue | undefined {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + id);
    return raw ? (JSON.parse(raw) as CachedIssue) : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(id: number, entry: CachedIssue) {
  try {
    window.localStorage.setItem(KEY_PREFIX + id, JSON.stringify(entry));
  } catch {
    // Storage blocked: the issue still shows, it just is not kept.
  }
}

/** This tablet's last copy of the issue: its own, else the newer one in the depot's list. */
export function cachedIssue(id: number, depot?: string): CachedIssue | undefined {
  const own = readCache(id);
  const list = depot ? cachedIssues(depot) : undefined;
  const fromList = list?.issues.find((i) => i.id === id);
  if (fromList && list && (!own || list.fetchedAt > own.fetchedAt)) {
    return { issue: fromList, fetchedAt: list.fetchedAt };
  }
  return own;
}

/** The issue from the server, or the last copy when the server cannot be reached. */
export async function loadIssue(transport: Transport, id: number, depot?: string): Promise<LoadedIssue> {
  try {
    const issue = await transport.fetchIssue(id);
    if (!issue) return { kind: "not_found" };
    const entry = { issue, fetchedAt: new Date().toISOString() };
    writeCache(id, entry);
    return { kind: "ok", ...entry, source: "server" };
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    const cached = cachedIssue(id, depot);
    return cached ? { kind: "ok", ...cached, source: "cache" } : { kind: "unavailable" };
  }
}
