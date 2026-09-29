// Offline outbox: every loader write becomes a QueuedAction with a
// client_action_id, is applied to the cached run straight away, and is sent
// later by the sync engine. The server treats a replayed client_action_id as
// the same write, so retries are safe.

import type {
  FlagActionPayload,
  LoadState,
  OrderActionPayload,
  QueuedAction,
  QueuedActionPayload,
  QueuedActionType,
  Run,
} from "../types";
import { putOutboxAction } from "./db";

export interface NewAction {
  action_type: QueuedActionType;
  run_code: string;
  plan_version: number;
  payload: QueuedActionPayload;
}

/** Save a write to the outbox. Returns the stored action. */
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
  path: string;
  /** Always carries client_action_id. */
  body: Record<string, unknown>;
}

const enc = encodeURIComponent;

// Paths follow LOADER_FEATURES.md; confirm against API_CONTRACT.md.
const ENDPOINTS: Record<QueuedActionType, (a: QueuedAction) => Pick<ActionRequest, "method" | "path">> = {
  check: (a) => ({ method: "POST", path: orderPath(a, "check") }),
  uncheck: (a) => ({ method: "DELETE", path: orderPath(a, "check") }),
  unload: (a) => ({ method: "POST", path: orderPath(a, "unload") }),
  recheck: (a) => ({ method: "POST", path: orderPath(a, "recheck") }),
  flag: () => ({ method: "POST", path: "/loader/issues" }),
  acknowledge: (a) => ({ method: "POST", path: `/loader/runs/${enc(a.run_code)}/plan/${a.plan_version}/acknowledge` }),
  release: (a) => ({ method: "POST", path: `/loader/runs/${enc(a.run_code)}/release` }),
};

function orderPath(a: QueuedAction, verb: string): string {
  const { order_number } = a.payload as OrderActionPayload;
  return `/loader/runs/${enc(a.run_code)}/orders/${enc(order_number)}/${verb}`;
}

/** HTTP request for an action; client_action_id goes in every JSON body. */
export function requestFor(action: QueuedAction): ActionRequest {
  return {
    ...ENDPOINTS[action.action_type](action),
    body: {
      client_action_id: action.client_action_id,
      run_code: action.run_code,
      plan_version: action.plan_version,
      ...action.payload,
    },
  };
}

// ---- Optimistic apply --------------------------------------------------

const ORDER_STATE_AFTER: Partial<Record<QueuedActionType, LoadState>> = {
  check: "loaded",
  uncheck: "to_load",
  unload: "moved",
  recheck: "loaded",
  flag: "flagged",
};

/**
 * Apply an action to a run locally, so the checklist shows the result before
 * the server confirms it. Returns a new run; the input is not changed.
 */
export function applyAction(run: Run, action: QueuedAction, checkedBy?: string): Run {
  if (action.action_type === "acknowledge") {
    return {
      ...run,
      acknowledged_plan_version: action.plan_version,
      acknowledged_by: checkedBy,
      acknowledged_at: action.created_at,
    };
  }
  if (action.action_type === "release") {
    return { ...run, status: "ready_to_depart", signed_off_by: checkedBy, signed_off_at: action.created_at };
  }

  const nextState = ORDER_STATE_AFTER[action.action_type];
  const { order_number } = action.payload as OrderActionPayload | FlagActionPayload;
  if (!nextState || !order_number) return run;

  const loaded = nextState === "loaded";
  return {
    ...run,
    status: run.status === "not_started" ? "loading" : run.status,
    stops: run.stops.map((stop) => ({
      ...stop,
      orders: stop.orders.map((order) =>
        order.order_number !== order_number
          ? order
          : {
              ...order,
              load_state: nextState,
              checked_at: loaded ? action.created_at : undefined,
              checked_by: loaded ? checkedBy : undefined,
            },
      ),
    })),
  };
}
