// Offline outbox: every loader write becomes a QueuedAction with a
// client_action_id, is applied to the cached run straight away, and is sent
// later by the sync engine. The server answers a replayed client_action_id
// with the original result and 200, so retries are safe.

import { withRecomputedCounts } from "../format";
import type {
  CheckActionPayload,
  FlagActionPayload,
  OrderState,
  QueuedAction,
  QueuedActionPayload,
  QueuedActionType,
  Run,
  UnloadActionPayload,
} from "../types";
import { putOutboxAction } from "./db";

export interface NewAction {
  action_type: QueuedActionType;
  run_code: string;
  plan_version: number;
  payload: QueuedActionPayload;
}

/** Save a write to the outbox. Call once per tap; retries reuse the id. */
export async function enqueue(input: NewAction): Promise<QueuedAction> {
  const action: QueuedAction = {
    ...input,
    client_action_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  };
  await putOutboxAction(action);
  return action;
}

// ---- Requests ----------------------------------------------------------

export interface ActionRequest {
  method: "POST" | "DELETE";
  /** Relative to /api/v1. */
  path: string;
  /** Always carries client_action_id. */
  body: Record<string, unknown>;
}

const enc = encodeURIComponent;

function orderPath(a: QueuedAction, verb: string): string {
  const { order_number } = a.payload as CheckActionPayload | UnloadActionPayload;
  return `/loader/runs/${enc(a.run_code)}/orders/${enc(order_number)}/${verb}`;
}

const runPath = (a: QueuedAction) => `/loader/runs/${enc(a.run_code)}`;

// Paths from docs/loader/API_CONTRACT.md. The contract names unload and
// acknowledge without paths; those two follow LOADER_FEATURES.md (L7).
const ENDPOINTS: Record<QueuedActionType, (a: QueuedAction) => Pick<ActionRequest, "method" | "path">> = {
  check: (a) => ({ method: "POST", path: orderPath(a, "check") }),
  uncheck: (a) => ({ method: "DELETE", path: orderPath(a, "check") }),
  unload: (a) => ({ method: "POST", path: orderPath(a, "unload") }),
  flag: () => ({ method: "POST", path: "/loader/issues" }),
  acknowledge: (a) => ({ method: "POST", path: `${runPath(a)}/plan/${a.plan_version}/acknowledge` }),
  release: (a) => ({ method: "POST", path: `${runPath(a)}/release` }),
  release_undo: (a) => ({ method: "POST", path: `${runPath(a)}/release/undo` }),
};

/** JSON body: client_action_id plus what the contract shows for that write. */
function bodyFor(action: QueuedAction): Record<string, unknown> {
  const id = { client_action_id: action.client_action_id };
  switch (action.action_type) {
    case "check":
    case "uncheck": {
      const { loader_session_id } = action.payload as CheckActionPayload;
      return { ...id, loader_session_id };
    }
    case "flag":
      return { ...(action.payload as FlagActionPayload), ...id };
    default:
      return id;
  }
}

export function requestFor(action: QueuedAction): ActionRequest {
  return { ...ENDPOINTS[action.action_type](action), body: bodyFor(action) };
}

// ---- Optimistic apply --------------------------------------------------

// A check on a re_check order clears it; there is no separate recheck write.
const ORDER_STATE_AFTER: Partial<Record<QueuedActionType, OrderState>> = {
  check: "loaded",
  uncheck: "to_load",
  unload: "moved",
  flag: "flagged",
};

/**
 * Apply an action to a run locally, so the checklist shows the result before
 * the server confirms it. Returns a new run with counts and capacity
 * recomputed; the input is not changed.
 */
export function applyAction(run: Run, action: QueuedAction, actorName?: string): Run {
  const by = actorName ?? null;

  switch (action.action_type) {
    case "acknowledge":
      return {
        ...run,
        current_plan_version: action.plan_version,
        unacknowledged_plan_version: null,
        plan: { ...run.plan, version: action.plan_version, acknowledged_at: action.created_at, acknowledged_by: by },
      };
    case "release":
      return { ...run, status: "ready_to_depart" };
    case "release_undo":
      return { ...run, status: "loaded" };
  }

  const nextState = ORDER_STATE_AFTER[action.action_type];
  const { order_number } = action.payload as CheckActionPayload | UnloadActionPayload | FlagActionPayload;
  if (!nextState || !order_number) return run;

  const loaded = nextState === "loaded";
  const next: Run = {
    ...run,
    status:
      action.action_type === "flag"
        ? "issue_flagged"
        : run.status === "not_started"
          ? "loading"
          : run.status,
    stops: run.stops.map((stop) => ({
      ...stop,
      orders: stop.orders.map((order) =>
        order.order_number !== order_number
          ? order
          : {
              ...order,
              state: nextState,
              checked_at: loaded ? action.created_at : null,
              checked_by: loaded ? by : null,
            },
      ),
    })),
  };
  return withRecomputedCounts(next);
}
