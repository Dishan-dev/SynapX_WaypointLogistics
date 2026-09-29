"use client";

import * as React from "react";
import { listOutbox, putCachedRun } from "@/lib/loader/offline/db";
import { applyAction, enqueue, type NewAction } from "@/lib/loader/offline/outbox";
import { resolveRun, type RunSource } from "@/lib/loader/offline/run-cache";
import { flushOutbox } from "@/lib/loader/offline/sync";
import { createTransport, probeConnectivity, type Transport } from "@/lib/loader/offline/transport";
import type {
  ActionInput,
  QueuedAction,
  QueuedActionPayload,
  QueuedActionType,
  Run,
  SyncState,
} from "@/lib/loader/types";

const PROBE_ONLINE_MS = 30_000;
const PROBE_OFFLINE_MS = 5_000;

interface LoaderSyncValue {
  sync: SyncState;
  /** Queue a write; it is sent now if online, otherwise on reconnect. */
  enqueueAction: (input: NewAction) => Promise<QueuedAction>;
  flush: () => Promise<void>;
  /** Used to refetch runs after a sync. */
  transport: Transport;
  /** Sent as loader_session_id on every write. */
  sessionId: number;
}

const LoaderSyncContext = React.createContext<LoaderSyncValue | null>(null);

export function useLoaderSync(): LoaderSyncValue {
  const ctx = React.useContext(LoaderSyncContext);
  if (!ctx) throw new Error("useLoaderSync must be used inside <LoaderSyncProvider>");
  return ctx;
}

/**
 * Tracks connectivity, owns the outbox and flushes it on reconnect, when the
 * tab becomes visible, and on a timer.
 */
export function LoaderSyncProvider({
  sessionId,
  children,
}: {
  sessionId: number;
  children: React.ReactNode;
}) {
  const transport = React.useMemo(() => createTransport(), []);
  const [online, setOnline] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [counts, setCounts] = React.useState({ pending: 0, failed: 0 });
  const [lastSyncedAt, setLastSyncedAt] = React.useState<string>();
  const flushing = React.useRef(false);

  const refreshCounts = React.useCallback(async () => {
    try {
      const outbox = await listOutbox();
      setCounts({
        pending: outbox.filter((a) => a.status === "pending").length,
        failed: outbox.filter((a) => a.status !== "pending").length,
      });
    } catch {
      // IndexedDB unavailable (private mode): nothing queued to count.
    }
  }, []);

  const flush = React.useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSyncing(true);
    try {
      const result = await flushOutbox(transport);
      setOnline(!result.offline);
      if (!result.offline) setLastSyncedAt(new Date().toISOString());
    } catch {
      // IndexedDB error: leave the outbox for the next attempt.
    } finally {
      flushing.current = false;
      setSyncing(false);
      await refreshCounts();
    }
  }, [transport, refreshCounts]);

  const check = React.useCallback(async () => {
    const reachable = await probeConnectivity();
    setOnline(reachable);
    if (reachable) await flush();
    else await refreshCounts();
  }, [flush, refreshCounts]);

  // Connectivity: browser events, visibility, and a probe that runs faster while offline.
  React.useEffect(() => {
    // First check right after mount, as a callback like the other triggers.
    const initial = window.setTimeout(() => void check(), 0);
    const onOnline = () => void check();
    const onOffline = () => setOnline(false);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  React.useEffect(() => {
    const id = window.setInterval(() => void check(), online ? PROBE_ONLINE_MS : PROBE_OFFLINE_MS);
    return () => window.clearInterval(id);
  }, [online, check]);

  const enqueueAction = React.useCallback(
    async (input: NewAction) => {
      const action = await enqueue(input);
      await refreshCounts();
      if (online) void flush();
      return action;
    },
    [online, flush, refreshCounts],
  );

  const value = React.useMemo<LoaderSyncValue>(
    () => ({
      sync: { online, syncing, pending: counts.pending, failed: counts.failed, lastSyncedAt },
      enqueueAction,
      flush,
      transport,
      sessionId,
    }),
    [online, syncing, counts, lastSyncedAt, enqueueAction, flush, transport, sessionId],
  );

  return <LoaderSyncContext.Provider value={value}>{children}</LoaderSyncContext.Provider>;
}

/**
 * A run that survives reloads and offline use. The server copy wins while
 * nothing is pending for the run; while actions are pending the local copy is
 * kept, and after each sync the run is resolved again (see run-cache.ts).
 * Each action is applied locally as soon as it is queued.
 */
export function useOfflineRun(initial: Run, actorName?: string) {
  const { enqueueAction, transport, sync, sessionId } = useLoaderSync();
  const [run, setRun] = React.useState(initial);
  const [source, setSource] = React.useState<RunSource>("initial");
  const runRef = React.useRef(initial);
  // Bumped on every local action, so a slower resolve cannot overwrite it.
  const actSeq = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    const seq = actSeq.current;
    resolveRun(initial, transport)
      .then((resolved) => {
        if (cancelled || seq !== actSeq.current) return;
        runRef.current = resolved.run;
        setRun(resolved.run);
        setSource(resolved.source);
      })
      .catch(() => {
        // Unexpected storage error: keep showing what we have.
      });
    return () => {
      cancelled = true;
    };
  }, [initial, transport, sync.lastSyncedAt]);

  const act = React.useCallback(
    async (actionType: QueuedActionType, input: ActionInput = {}) => {
      actSeq.current += 1;
      const current = runRef.current;
      const action = await enqueueAction({
        action_type: actionType,
        run_code: current.code,
        plan_version: current.current_plan_version,
        payload: { ...input, loader_session_id: sessionId } as QueuedActionPayload,
      });
      const next = applyAction(current, action, actorName);
      runRef.current = next;
      setRun(next);
      setSource("local");
      await putCachedRun(next);
      return action;
    },
    [enqueueAction, actorName, sessionId],
  );

  /** source: where the shown run came from (server, local, cache or initial). */
  return { run, source, act };
}
