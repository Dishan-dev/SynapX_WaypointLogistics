// How the tablet talks to the server: queued writes, run refetches and
// sign-in. The mock transport stands in until the /loader endpoints are wired
// up; set NEXT_PUBLIC_LOADER_TRANSPORT=api to use the real API at
// NEXT_PUBLIC_API_URL.

import { withRecomputedCounts } from "../format";
import { findMockRun, mockSession, mockUserPins, mockUsers } from "../mock-data";
import type {
  LoaderSession,
  LoaderUser,
  OrderState,
  QueuedAction,
  QueuedActionType,
  Run,
  SessionEndReason,
  SessionRequest,
} from "../types";
import { applyAction, type ActionRequest } from "./outbox";

export interface TransportResponse {
  status: number;
  body?: unknown;
}

export interface Transport {
  /** Throws NetworkError when the server cannot be reached. */
  send(request: ActionRequest): Promise<TransportResponse>;
  /**
   * GET /loader/runs/{code}. Undefined when the run does not exist; throws
   * NetworkError when the server cannot be reached.
   */
  fetchRun(code: string): Promise<Run | undefined>;
  /** GET /loader/users: the loaders registered at this tablet's depot. */
  fetchUsers(): Promise<LoaderUser[]>;
  /** POST /loader/session. Undefined for a wrong PIN (401); throws NetworkError when unreachable. */
  startSession(body: SessionRequest): Promise<LoaderSession | undefined>;
  /** DELETE /loader/session/{id}. Throws NetworkError when it has to be sent again later. */
  endSession(sessionId: number, reason: SessionEndReason): Promise<void>;
}

export class NetworkError extends Error {
  constructor(message = "Network unreachable") {
    super(message);
    this.name = "NetworkError";
  }
}

const PROBE_TIMEOUT_MS = 4000;

/**
 * True when this tablet can reach the app server. navigator.onLine alone
 * reports true on Wi-Fi with no upstream, so we make a real, uncached request.
 */
export async function probeConnectivity(): Promise<boolean> {
  try {
    const res = await fetch(`/favicon.ico?probe=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function apiTransport(baseUrl: string): Transport {
  const api = `${baseUrl}/api/v1`;
  return {
    async send({ method, path, body }) {
      let res: Response;
      try {
        res = await fetch(`${api}${path}`, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        throw new NetworkError();
      }
      const text = await res.text();
      return { status: res.status, body: text ? safeJson(text) : undefined };
    },
    async fetchRun(code) {
      let res: Response;
      try {
        res = await fetch(`${api}/loader/runs/${encodeURIComponent(code)}`, { cache: "no-store" });
      } catch {
        throw new NetworkError();
      }
      if (res.status === 404) return undefined;
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as Run;
    },
    async fetchUsers() {
      const res = await request(`${api}/loader/users`, { cache: "no-store" });
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as LoaderUser[];
    },
    async startSession(body) {
      const res = await request(`${api}/loader/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 401) return undefined;
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as LoaderSession;
    },
    async endSession(sessionId, reason) {
      const res = await request(`${api}/loader/session/${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ end_reason: reason }),
      });
      // 404: already ended or unknown, nothing left to do. Other 4xx will not
      // succeed on a retry either.
      if (res.status >= 500) throw new NetworkError(`HTTP ${res.status}`);
    },
  };
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new NetworkError();
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---- Mock server -------------------------------------------------------

// Versioned so a copy saved under an older data shape is not read back.
const MOCK_STATE_KEY = "waypoint-loader-mock-server-v2";
const MOCK_IDS_KEY = "waypoint-loader-mock-server-v2-ids";

function readJson<T>(key: string): T | undefined {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null") ?? undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked: the mock server simply forgets on reload.
  }
}

/** The mock "server" copy of each run, kept across reloads in this browser. */
const loadMockState = () => readJson<Record<string, Run>>(MOCK_STATE_KEY) ?? {};
const saveMockState = (state: Record<string, Run>) => writeJson(MOCK_STATE_KEY, state);

/** Each client_action_id the mock server applied, with the write it was used for. */
const loadMockIds = () => readJson<Record<string, string>>(MOCK_IDS_KEY) ?? {};
const saveMockIds = (ids: Record<string, string>) => writeJson(MOCK_IDS_KEY, ids);

const MOCK_SESSIONS_KEY = "waypoint-loader-mock-server-v2-sessions";

interface MockSessionRow {
  loader_user_id: number;
  ended_reason?: SessionEndReason;
}

/** Sessions the mock server started. mockSession (12) is seeded, like a session row in the API seed. */
const loadMockSessions = () => readJson<Record<string, MockSessionRow>>(MOCK_SESSIONS_KEY) ?? {};
const saveMockSessions = (rows: Record<string, MockSessionRow>) => writeJson(MOCK_SESSIONS_KEY, rows);

/** The loader behind a session id, or undefined when the mock server does not know it. */
function mockSessionUser(sessionId: number): LoaderUser | undefined {
  const userId =
    sessionId === mockSession.session_id ? mockSession.loader.id : loadMockSessions()[sessionId]?.loader_user_id;
  return mockUsers.find((u) => u.id === userId);
}

const mockServerRun = (state: Record<string, Run>, code: string) => state[code] ?? findMockRun(code);

/** Turn a write request back into the action it carries, for the mock server. */
function actionFromRequest({ method, path, body }: ActionRequest, plan: number) {
  const base = {
    client_action_id: String(body.client_action_id),
    created_at: new Date().toISOString(),
    attempts: 0,
    status: "pending" as const,
    plan_version: plan,
  };
  const order = /^\/loader\/runs\/([^/]+)\/orders\/([^/]+)\/(check|recheck|unload)$/.exec(path);
  if (order) {
    const type: QueuedActionType =
      order[3] === "check" ? (method === "DELETE" ? "uncheck" : "check") : (order[3] as "recheck" | "unload");
    return { ...base, action_type: type, run_code: decodeURIComponent(order[1]), payload: { order_number: decodeURIComponent(order[2]) } };
  }
  if (path === "/loader/issues") {
    return { ...base, action_type: "flag" as const, run_code: String(body.run_code), payload: { order_number: String(body.order_number) } };
  }
  const run = /^\/loader\/runs\/([^/]+)\/(?:plan\/(\d+)\/(acknowledge)|(release)(\/undo)?)$/.exec(path);
  if (run) {
    const type: QueuedActionType = run[3] ? "acknowledge" : run[5] ? "release_undo" : "release";
    return { ...base, action_type: type, run_code: decodeURIComponent(run[1]), plan_version: run[2] ? Number(run[2]) : plan, payload: {} };
  }
  return undefined;
}

function errorResponse(status: number, code: string, message: string, extra: object = {}): TransportResponse {
  return { status, body: { detail: { code, message, ...extra } } };
}

// Row states each L4 write starts from (API_CONTRACT.md "Check · uncheck ·
// recheck"). check also confirms a re_check row, as recheck does. A row
// already where the write would put it is a no-op.
const ORDER_WRITES: Partial<Record<QueuedActionType, { from: OrderState[]; noop: OrderState[] }>> = {
  check: { from: ["to_load", "new", "re_check"], noop: ["loaded"] },
  uncheck: { from: ["loaded"], noop: ["to_load", "new"] },
  recheck: { from: ["re_check"], noop: ["loaded"] },
};

/** How the mock server answers an order write: an error, a no-op, or undefined to apply it. */
function orderWriteOutcome(run: Run, action: QueuedAction): TransportResponse | "noop" | undefined {
  const rule = ORDER_WRITES[action.action_type];
  if (!rule) return undefined;
  const { order_number } = action.payload as { order_number: string };
  const order = run.stops.flatMap((s) => s.orders).find((o) => o.order_number === order_number);
  if (!order) {
    return errorResponse(404, "NOT_FOUND", `Order '${order_number}' is not on ${run.code}.`, {
      entity: "Order",
      entity_id: order_number,
    });
  }
  if (rule.noop.includes(order.state)) return "noop";
  if (run.status === "ready_to_depart" || run.status === "gated_out" || !rule.from.includes(order.state)) {
    return errorResponse(409, "INVALID_STATE_TRANSITION", `Cannot ${action.action_type} ${order_number} while it is ${order.state}.`, {
      entity: "Order",
      entity_id: order_number,
    });
  }
  return undefined;
}

/**
 * Behaves like the write contract, so the outbox can be tested without the
 * API: needs a reachable server; answers a replayed client_action_id with 200
 * and the run as it is now, and the same id on a different write with 409
 * CLIENT_ACTION_ID_REUSED; refuses a write made on an old plan with 409
 * PLAN_VERSION_STALE (the replay check runs first); follows the L4 row rules.
 * Writes apply to the mock server's own copy of the run, so GET
 * /loader/runs/{code} returns the server's view (including writes from other
 * tablets in this browser).
 */
export function mockTransport(latencyMs = 300): Transport {
  return {
    async send(request) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));

      const id = String(request.body.client_action_id);
      const signature = `${request.method} ${request.path}`;
      const state = loadMockState();
      const ids = loadMockIds();
      const code = decodeURIComponent(/^\/loader\/runs\/([^/]+)/.exec(request.path)?.[1] ?? String(request.body.run_code));
      const run = mockServerRun(state, code);
      // POST /loader/issues returns the issue; the mock has none, and the
      // outbox reads no success bodies.
      const ok = (current: Run | undefined): TransportResponse => ({
        status: 200,
        body: request.path === "/loader/issues" ? { client_action_id: id } : current,
      });

      if (ids[id]) {
        return ids[id] === signature
          ? ok(run)
          : errorResponse(409, "CLIENT_ACTION_ID_REUSED", `client_action_id ${id} was already used for another action.`);
      }

      const action = run && (actionFromRequest(request, run.current_plan_version) as QueuedAction | undefined);
      if (!run || !action) {
        return errorResponse(404, "NOT_FOUND", `Run '${code}' not found.`, { entity: "DeliveryRun", entity_id: code });
      }

      const sent = Number(request.body.plan_version);
      if (sent !== run.current_plan_version) {
        return errorResponse(
          409,
          "PLAN_VERSION_STALE",
          `Plan changed to v${run.current_plan_version}; this action was made on v${sent}.`,
          { entity: "DeliveryRun", entity_id: run.code, current_plan_version: run.current_plan_version, sent_plan_version: sent },
        );
      }

      const outcome = orderWriteOutcome(run, action);
      if (outcome === "noop") return ok(run);
      if (outcome) return outcome;

      // The server records who checked from the session. Null leaves
      // checked_by empty; an ended session is still accepted (offline taps
      // replay after sign-out); an id it never issued is a 404, as on the API.
      const sessionId = request.body.loader_session_id ?? null;
      const sessionUser = sessionId === null ? undefined : mockSessionUser(Number(sessionId));
      if (sessionId !== null && !sessionUser) {
        return errorResponse(404, "NOT_FOUND", `Loader session ${String(sessionId)} not found.`, {
          entity: "LoaderSession",
          entity_id: sessionId,
        });
      }
      const by = sessionUser?.short_name;
      state[run.code] = applyAction(run, action, by);
      ids[id] = signature;
      saveMockState(state);
      saveMockIds(ids);
      return ok(state[run.code]);
    },
    async fetchRun(code) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return mockServerRun(loadMockState(), code);
    },
    async fetchUsers() {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return mockUsers;
    },
    async startSession({ loader_user_id, pin }) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      const user = mockUsers.find((u) => u.id === loader_user_id);
      if (!user || mockUserPins[user.id] !== pin) return undefined;

      const rows = loadMockSessions();
      const id = Math.max(mockSession.session_id, ...Object.keys(rows).map(Number)) + 1;
      rows[id] = { loader_user_id: user.id };
      saveMockSessions(rows);
      return {
        session_id: id,
        loader: { id: user.id, short_name: user.short_name },
        dock: mockSession.dock,
        depot: mockSession.depot,
        started_at: new Date().toISOString(),
      };
    },
    async endSession(sessionId, reason) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      const rows = loadMockSessions();
      if (rows[sessionId] && !rows[sessionId].ended_reason) {
        rows[sessionId] = { ...rows[sessionId], ended_reason: reason };
        saveMockSessions(rows);
      }
    },
  };
}

/**
 * Mock transport only, for the dev kit: what POST
 * /loader/dev/runs/{code}/plan-change does on the API. Publishes the next plan
 * version on the mock server, waiting to be acknowledged. The first loaded
 * order becomes re_check, so recheck can be tried once acknowledged.
 */
export function simulateMockPlanChange(code: string): Run | undefined {
  const state = loadMockState();
  const run = mockServerRun(state, code);
  if (!run) return undefined;

  const version = run.current_plan_version + 1;
  let marked = false;
  const next = withRecomputedCounts({
    ...run,
    current_plan_version: version,
    unacknowledged_plan_version: version,
    plan: { ...run.plan, version, published_at: new Date().toISOString(), acknowledged_at: null, acknowledged_by: null },
    stops: run.stops.map((stop) => ({
      ...stop,
      orders: stop.orders.map((order) => {
        if (marked || order.state !== "loaded") return order;
        marked = true;
        return { ...order, state: "re_check" as const, changed_in_version: version };
      }),
    })),
  });
  const reopened = run.status === "loaded" && next.orders_checked < next.orders_total;
  state[code] = { ...next, status: reopened ? "loading" : run.status };
  saveMockState(state);
  return state[code];
}

export function createTransport(): Transport {
  return process.env.NEXT_PUBLIC_LOADER_TRANSPORT === "api"
    ? apiTransport(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000")
    : mockTransport();
}
