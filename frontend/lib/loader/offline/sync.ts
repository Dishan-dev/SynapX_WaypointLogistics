// Sends the outbox in order. Stops at the first network or server error so
// later actions never overtake earlier ones.

import { deleteOutboxAction, listOutbox, putOutboxAction } from "./db";
import { requestFor } from "./outbox";
import { NetworkError, type Transport } from "./transport";

export interface FlushResult {
  sent: number;
  /** Stopped because the server could not be reached. */
  offline: boolean;
}

// Error envelope: { detail: { code, message, ... } } (API_CONTRACT.md "Errors").
function detail(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object" || !("detail" in body)) return fallback;
  const d = body.detail;
  if (d && typeof d === "object" && "code" in d) {
    return "message" in d ? `${String(d.code)}: ${String(d.message)}` : String(d.code);
  }
  return String(d);
}

export async function flushOutbox(transport: Transport): Promise<FlushResult> {
  const pending = (await listOutbox()).filter((a) => a.status === "pending");
  let sent = 0;

  for (const action of pending) {
    let res;
    try {
      res = await transport.send(requestFor(action));
    } catch (err) {
      if (!(err instanceof NetworkError)) throw err;
      await putOutboxAction({ ...action, attempts: action.attempts + 1, last_error: err.message });
      return { sent, offline: true };
    }

    if (res.status >= 200 && res.status < 300) {
      await deleteOutboxAction(action.client_action_id);
      sent += 1;
    } else if (res.status === 409) {
      // INVALID_STATE_TRANSITION: the run moved on (e.g. gated out). Keep it
      // for review, never retry.
      await putOutboxAction({
        ...action,
        status: "conflict",
        attempts: action.attempts + 1,
        last_error: detail(res.body, "INVALID_STATE_TRANSITION"),
      });
    } else if (res.status >= 500) {
      // Server trouble: keep order, retry on the next flush.
      await putOutboxAction({
        ...action,
        attempts: action.attempts + 1,
        last_error: detail(res.body, `HTTP ${res.status}`),
      });
      return { sent, offline: false };
    } else {
      await putOutboxAction({
        ...action,
        status: "failed",
        attempts: action.attempts + 1,
        last_error: detail(res.body, `HTTP ${res.status}`),
      });
    }
  }
  return { sent, offline: false };
}
