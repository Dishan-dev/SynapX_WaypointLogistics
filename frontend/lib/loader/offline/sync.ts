// Sends the outbox in order. Stops at the first network or server error so
// later actions never overtake earlier ones.

import type { ConflictCode } from "../types";
import { deleteOutboxAction, listOutbox, putOutboxAction } from "./db";
import { requestFor } from "./outbox";
import { NetworkError, type Transport } from "./transport";

export interface FlushResult {
  sent: number;
  /** Stopped because the server could not be reached. */
  offline: boolean;
  /** Runs with a write refused as PLAN_VERSION_STALE during this flush. */
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

const CONFLICT_CODES: ConflictCode[] = ["PLAN_VERSION_STALE", "CLIENT_ACTION_ID_REUSED", "INVALID_STATE_TRANSITION"];

function conflictCode(d: Record<string, unknown> | undefined): ConflictCode {
  const code = d?.code as ConflictCode | undefined;
  return code && CONFLICT_CODES.includes(code) ? code : "INVALID_STATE_TRANSITION";
}

export async function flushOutbox(transport: Transport): Promise<FlushResult> {
  const pending = (await listOutbox()).filter((a) => a.status === "pending");
  let sent = 0;
  const staleRuns = new Set<string>();
  const result = (offline: boolean): FlushResult => ({ sent, offline, staleRuns: [...staleRuns] });

  for (const action of pending) {
    let res;
    try {
      res = await transport.send(requestFor(action));
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err;
      await putOutboxAction({ ...action, attempts: action.attempts + 1, last_error: err.message });
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
      if (code === "PLAN_VERSION_STALE") staleRuns.add(action.run_code);
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
