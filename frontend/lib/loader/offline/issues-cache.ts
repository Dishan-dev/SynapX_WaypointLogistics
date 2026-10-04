// The Issues tab's list: GET /loader/issues for the depot, with this tablet's
// last copy for offline use, plus flags still in the outbox (not sent yet, or
// refused), which have no server id.

import type { FlagActionPayload, LoaderIssue, QueuedAction } from "../types";
import { listOutbox } from "./db";
import { NetworkError, type Transport } from "./transport";

const KEY_PREFIX = "waypoint-loader-issues:";

/** Fired on window after a fresh list loads; detail is { depot, waiting }, for the Issues badge. */
export const ISSUES_EVENT = "waypoint-loader-issues";

export interface LoadedIssues {
  issues: LoaderIssue[];
  fetchedAt: string;
  source: "server" | "cache";
}

function readCache(depot: string): LoadedIssues | undefined {
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + depot);
    return raw ? { ...(JSON.parse(raw) as Omit<LoadedIssues, "source">), source: "cache" } : undefined;
  } catch {
    return undefined;
  }
}

function writeCache(depot: string, entry: Omit<LoadedIssues, "source">) {
  try {
    window.localStorage.setItem(KEY_PREFIX + depot, JSON.stringify(entry));
  } catch {
    // Storage blocked: the list still shows, it just is not kept.
  }
}

/** This tablet's last copy of the depot's issues. */
export function cachedIssues(depot: string): LoadedIssues | undefined {
  return readCache(depot);
}

/** The depot's issues from the server, or the last copy when it cannot be reached. */
export async function loadIssues(transport: Transport, depot: string): Promise<LoadedIssues | undefined> {
  try {
    const issues = await transport.fetchIssues({});
    const entry = { issues, fetchedAt: new Date().toISOString() };
    writeCache(depot, entry);
    const waiting = issues.filter((i) => i.status === "sent" || i.status === "seen").length;
    window.dispatchEvent(new CustomEvent(ISSUES_EVENT, { detail: { depot, waiting } }));
    return { ...entry, source: "server" };
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err;
    return readCache(depot);
  }
}

/** A flag this tablet made that the server has not accepted (yet). */
export interface LocalFlag {
  clientActionId: string;
  runCode: string;
  flag: FlagActionPayload;
  createdAt: string;
  /** pending: waiting to send; conflict / failed: refused, will not be retried. */
  status: QueuedAction["status"];
  /** Why the server refused it: the 409's detail.code, or the error text of another 4xx. */
  conflictCode?: QueuedAction["conflict_code"];
  lastError?: string;
}

/** Flags in the outbox, newest first. */
export async function localFlags(): Promise<LocalFlag[]> {
  try {
    const outbox = await listOutbox();
    return outbox
      .filter((a) => a.action_type === "flag")
      .map((a) => ({
        clientActionId: a.client_action_id,
        runCode: a.run_code,
        flag: a.payload as FlagActionPayload,
        createdAt: a.created_at,
        status: a.status,
        conflictCode: a.conflict_code,
        lastError: a.last_error,
      }))
      .reverse();
  } catch {
    return [];
  }
}
