// Sends the outbox in order. Stops at the first network or server error so
// later actions never overtake earlier ones.

import { isPlanConflict, type ConflictCode, type QueuedAction, type QueuedActionPayload } from "../types";
import { deleteOutboxAction, listOutbox, putOutboxAction } from "./db";
import { requestFor } from "./outbox";
import { NetworkError, type Transport, type TransportResponse } from "./transport";

export interface FlushResult {
  sent: number;
  /** Stopped because the server could not be reached. */
  offline: boolean;
  /** Runs with a write refused because the plan moved on during this flush. */
  staleRuns: string[];
}

// Error envelope: { detail: { code, message, ... } } (API_CONTRACT.md "Errors").
function errorDetail(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object" || !("detail" in body)) return undefined;
  const d = body.detail;
  return d && typeof d === "object" ? (d as Record<string, unknown>) : undefined;
}

function detail(body: unknown, fallback: string): string {
  const d = errorDetail(body);
  if (d && "code" in d) return "message" in d ? `${String(d.code)}: ${String(d.message)}` : String(d.code);
  if (body && typeof body === "object" && "detail" in body) return String(body.detail);
  return fallback;
}

const CONFLICT_CODES: ConflictCode[] = [
  "PLAN_VERSION_STALE",
  "PLAN_NOT_ACKNOWLEDGED",
  "CLIENT_ACTION_ID_REUSED",
  "INVALID_STATE_TRANSITION",
];

function conflictCode(d: Record<string, unknown> | undefined): ConflictCode {
  const code = d?.code as ConflictCode | undefined;
  return code && CONFLICT_CODES.includes(code) ? code : "INVALID_STATE_TRANSITION";
}

/** A 404 for the loader_session_id rather than for the run or order. */
function isUnknownSession(res: TransportResponse): boolean {
  return res.status === 404 && errorDetail(res.body)?.entity === "LoaderSession";
}

async function send(transport: Transport, action: QueuedAction): Promise<TransportResponse | NetworkError> {
  try {
    return await transport.send(requestFor(action));
  } catch (err) {
    if (err instanceof NetworkError) return err;
    throw err;
  }
}

export async function flushOutbox(transport: Transport): Promise<FlushResult> {
  const pending = (await listOutbox()).filter((a) => a.status === "pending");
  let sent = 0;
  const staleRuns = new Set<string>();
  const result = (offline: boolean): FlushResult => ({ sent, offline, staleRuns: [...staleRuns] });

  for (const queued of pending) {
    let action = queued;
    let res = await send(transport, action);

    // loader_session_id is optional until L2, but an id the server does not
    // know is a 404. A tap queued under one (an old mock id, a session removed
    // on the server) is sent again once without it, so the tap is kept and
    // only checked_by stays empty. The 404 stored nothing, so the same
    // client_action_id is safe to reuse.
    if (!(res instanceof NetworkError) && isUnknownSession(res) && action.payload.loader_session_id !== null) {
      action = { ...action, payload: { ...action.payload, loader_session_id: null } as QueuedActionPayload };
      await putOutboxAction(action);
      res = await send(transport, action);
    }

    if (res instanceof NetworkError) {
      await putOutboxAction({ ...action, attempts: action.attempts + 1, last_error: res.message });
      return result(true);
    }

    if (res.status >= 200 && res.status < 300) {
      await deleteOutboxAction(action.client_action_id);
      sent += 1;
    } else if (res.status === 409) {
      // Final, never retried. PLAN_VERSION_STALE: the Dispatcher published a
      // new plan after the tap. The refetch after this flush brings it in, and
      // its unacknowledged_plan_version opens the plan-change takeover (L7).
      // Later actions are still sent: one the server already applied answers
      // 200 as a replay, since the replay check runs before the plan check.
      const d = errorDetail(res.body);
      const code = conflictCode(d);
      // PLAN_NOT_ACKNOWLEDGED (L7) is the same story: a plan this tap never saw.
      if (isPlanConflict(code)) staleRuns.add(action.run_code);
      if (code === "CLIENT_ACTION_ID_REUSED") console.error("Loader outbox reused a client_action_id", action);
      await putOutboxAction({
        ...action,
        status: "conflict",
        attempts: action.attempts + 1,
        conflict_code: code,
        current_plan_version: typeof d?.current_plan_version === "number" ? d.current_plan_version : undefined,
        last_error: detail(res.body, code),
      });
    } else if (res.status >= 500) {
      // Server trouble: keep order, retry on the next flush.
      await putOutboxAction({
        ...action,
        attempts: action.attempts + 1,
        last_error: detail(res.body, `HTTP ${res.status}`),
      });
      return result(false);
    } else {
      await putOutboxAction({
        ...action,
        status: "failed",
        attempts: action.attempts + 1,
        last_error: detail(res.body, `HTTP ${res.status}`),
      });
    }
  }
  return result(false);
}
