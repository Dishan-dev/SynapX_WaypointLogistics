/**
 * Offline Sync Queue — Waypoint Logistics
 *
 * Actions performed while offline (arrive, outcome, pod, complete, issue)
 * are saved to localStorage. When connectivity is restored, they are
 * flushed to POST /driver/sync in a single batch.
 */

import { apiFetch } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SyncActionType = "arrive" | "outcome" | "pod" | "complete" | "issue";

export interface PendingAction {
  action_id: string;
  action_type: SyncActionType;
  stop_id?: number;
  trip_id?: number;
  payload: Record<string, unknown>;
  client_timestamp: string;
  label: string;
}

export interface SyncConflict {
  action_id: string;
  stop_id?: number;
  reason: string;
  server_state: Record<string, unknown>;
}

export interface SyncResult {
  processed_count: number;
  conflicts: SyncConflict[];
}

export type QueueState = "idle" | "syncing" | "error";

// ─── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "waypoint_sync_queue";

// ─── In-memory mirror ─────────────────────────────────────────────────────────

let _queue: PendingAction[] = [];
let _state: QueueState = "idle";
let _lastError: string | null = null;
let _listeners: Array<() => void> = [];

function _save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_queue));
  } catch { /* Storage full */ }
}

function _notify() {
  _listeners.forEach((fn) => fn());
}

// ─── Init (call once at app startup) ─────────────────────────────────────────

export function initSyncQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    _queue = raw ? (JSON.parse(raw) as PendingAction[]) : [];
  } catch {
    _queue = [];
  }
  window.addEventListener("online", () => {
    if (_queue.length > 0) flush();
  });
}

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export function enqueue(action: Omit<PendingAction, "action_id" | "client_timestamp">) {
  const item: PendingAction = {
    ...action,
    action_id: crypto.randomUUID(),
    client_timestamp: new Date().toISOString(),
  };
  _queue = [..._queue, item];
  _save();
  _notify();
  if (navigator.onLine) flush();
}

// ─── Dequeue (remove one item) ────────────────────────────────────────────────

export function dequeue(action_id: string) {
  _queue = _queue.filter((a) => a.action_id !== action_id);
  _save();
  _notify();
}

// ─── Flush ────────────────────────────────────────────────────────────────────

let _flushInFlight = false;

export async function flush(): Promise<SyncResult | null> {
  if (_flushInFlight || _queue.length === 0) return null;
  _flushInFlight = true;
  _state = "syncing";
  _lastError = null;
  _notify();

  try {
    const result = await apiFetch<SyncResult>("/driver/sync", {
      method: "POST",
      body: JSON.stringify(_queue),
    });

    const failedIds = new Set(result.conflicts.map((c) => c.action_id));
    _queue = _queue.filter((a) => failedIds.has(a.action_id));
    _save();
    _state = "idle";
    _notify();
    return result;
  } catch (err: unknown) {
    _lastError = err instanceof Error ? err.message : "Sync failed";
    _state = "error";
    _notify();
    return null;
  } finally {
    _flushInFlight = false;
  }
}

// ─── Getters ──────────────────────────────────────────────────────────────────

export function getQueue(): PendingAction[] { return _queue; }
export function getState(): QueueState { return _state; }
export function getLastError(): string | null { return _lastError; }

// ─── Subscribe ────────────────────────────────────────────────────────────────

export function subscribe(fn: () => void): () => void {
  _listeners = [..._listeners, fn];
  return () => { _listeners = _listeners.filter((l) => l !== fn); };
}
