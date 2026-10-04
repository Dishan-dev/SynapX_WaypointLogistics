// How the tablet talks to the server: queued writes, run refetches and
// sign-in. The mock transport stands in until the /loader endpoints are wired
// up; set NEXT_PUBLIC_LOADER_TRANSPORT=api to use the real API at
// NEXT_PUBLIC_API_URL.

import { FLAGGABLE_STATES, ISSUE_TYPE_LABELS, planChangeAlert, UNDO_WINDOW_MS, withRecomputedCounts } from "../format";
import { findMockRun, mockActivity, mockIssues, mockQueue, mockSession, mockSummary, mockUserPins, mockUsers } from "../mock-data";
import { currentSessionId } from "../session";
import type {
  ActivityEntry,
  FlagActionPayload,
  IssueOption,
  LoaderIssue,
  LoaderSession,
  LoaderUser,
  OrderState,
  QueueSummary,
  QueuedAction,
  QueuedActionType,
  Run,
  RunQueue,
  RunStage,
  RunStatus,
  RunSummary,
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
   * GET /loader/runs/{code}. Undefined when the run does not exist (or is at
   * another depot, or its truck has not arrived); throws RunPickedError while
   * another loader holds it, NetworkError when the server cannot be reached.
   */
  fetchRun(code: string): Promise<Run | undefined>;
  /**
   * POST /loader/runs/{code}/pick: take the run, so only this loader can work
   * it. "taken" when another loader holds it. Needs a connection: throws
   * NetworkError when the server cannot be reached.
   */
  pickRun(code: string, sessionId: number): Promise<PickResult>;
  /** POST /loader/runs/{code}/unpick: put the run back for anyone to pick. */
  unpickRun(code: string, sessionId: number): Promise<PickResult>;
  /**
   * GET /loader/runs/{code}/activity, newest first. Undefined when the run does
   * not exist; throws NetworkError when the server cannot be reached.
   */
  fetchActivity(code: string): Promise<ActivityEntry[] | undefined>;
  /**
   * GET /loader/runs: every dock of the signed-in loader's depot, each with the
   * runs whose truck has arrived. Throws NetworkError when unreachable.
   */
  fetchQueue(): Promise<RunQueue>;
  /** GET /loader/summary: the depot's metric cards. Throws NetworkError when unreachable. */
  fetchSummary(): Promise<QueueSummary>;
  /**
   * GET /loader/issues?run=: the depot's flagged issues, newest first. Throws
   * NetworkError when unreachable.
   */
  fetchIssues(query: { run?: string }): Promise<LoaderIssue[]>;
  /**
   * GET /loader/issues/{id}: one issue, for the L8 waiting / decision screen.
   * Undefined when it does not exist; throws NetworkError when unreachable.
   */
  fetchIssue(id: number): Promise<LoaderIssue | undefined>;
  /**
   * POST /loader/issues/by-action/{client_action_id}/photo: attach a flag's
   * photo. "not_found" while the flag is not on the server yet (try after the
   * next sync); "rejected" for a 413 / 415. Throws NetworkError when unreachable.
   */
  uploadIssuePhoto(clientActionId: string, photo: Blob): Promise<"ok" | "not_found" | "rejected">;
  /** GET /loader/users?depot=: the loaders of the depot this tablet signs into. */
  fetchUsers(depot: string): Promise<LoaderUser[]>;
  /**
   * POST /loader/session. Undefined for a wrong PIN (401); throws
   * SignInRefusedError for a loader with no depot or another depot's (403),
   * NetworkError when unreachable.
   */
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

/** GET /loader/runs/{code} refused: another loader holds the run (409 RUN_PICKED_BY_OTHER). */
export class RunPickedError extends Error {
  constructor(
    readonly pickedBy: string,
    message = `${pickedBy} is loading this run.`,
  ) {
    super(message);
    this.name = "RunPickedError";
  }
}

/** Sign-in refused for this loader (403): no depot yet, or another depot's loader. */
export class SignInRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignInRefusedError";
  }
}

/** What a pick or unpick came to. run is unset for a run the mock server has no detail for. */
export type PickResult =
  | { kind: "picked"; run?: Run }
  | { kind: "taken"; pickedBy: string }
  | { kind: "gone" };

/** Tablet reads carry the signed-in session: the server scopes them to the loader's depot. */
function tabletRead(): RequestInit {
  const id = currentSessionId();
  return { cache: "no-store", headers: id === undefined ? {} : { "X-Loader-Session": String(id) } };
}

/** The error envelope's detail ({ detail: { code, message, ... } }). */
function errorBody(body: unknown): Record<string, unknown> {
  const detail = body && typeof body === "object" && "detail" in body ? (body as { detail: unknown }).detail : undefined;
  return detail && typeof detail === "object" ? (detail as Record<string, unknown>) : {};
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
      const res = await request(`${api}/loader/runs/${encodeURIComponent(code)}`, tabletRead());
      if (res.status === 404) return undefined;
      if (res.status === 409) {
        const d = errorBody(await res.json().catch(() => undefined));
        if (d.code === "RUN_PICKED_BY_OTHER") throw new RunPickedError(String(d.picked_by), String(d.message));
      }
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as Run;
    },
    pickRun: (code, sessionId) => pickRequest(`${api}/loader/runs/${encodeURIComponent(code)}/pick`, sessionId),
    unpickRun: (code, sessionId) => pickRequest(`${api}/loader/runs/${encodeURIComponent(code)}/unpick`, sessionId),
    async fetchActivity(code) {
      const res = await request(`${api}/loader/runs/${encodeURIComponent(code)}/activity`, tabletRead());
      if (res.status === 404) return undefined;
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as ActivityEntry[];
    },
    async fetchQueue() {
      const res = await request(`${api}/loader/runs`, tabletRead());
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as RunQueue;
    },
    async fetchSummary() {
      const res = await request(`${api}/loader/summary`, tabletRead());
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as QueueSummary;
    },
    async fetchIssues({ run }) {
      const params = new URLSearchParams();
      if (run) params.set("run", run);
      const res = await request(`${api}/loader/issues?${params}`, tabletRead());
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as LoaderIssue[];
    },
    async fetchIssue(id) {
      const res = await request(`${api}/loader/issues/${id}`, tabletRead());
      if (res.status === 404) return undefined;
      if (!res.ok) throw new NetworkError(`HTTP ${res.status}`);
      return (await res.json()) as LoaderIssue;
    },
    async uploadIssuePhoto(clientActionId, photo) {
      const form = new FormData();
      form.append("file", photo, `flag.${photo.type.split("/")[1] ?? "jpg"}`);
      const res = await request(`${api}/loader/issues/by-action/${encodeURIComponent(clientActionId)}/photo`, {
        method: "POST",
        body: form,
      });
      if (res.ok) return "ok";
      if (res.status === 404) return "not_found";
      if (res.status === 413 || res.status === 415) return "rejected";
      throw new NetworkError(`HTTP ${res.status}`);
    },
    async fetchUsers(depot) {
      const res = await request(`${api}/loader/users?depot=${encodeURIComponent(depot)}`, { cache: "no-store" });
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
      if (res.status === 403) {
        throw new SignInRefusedError(String(errorBody(await res.json().catch(() => undefined)).message ?? "Sign-in refused."));
      }
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

async function pickRequest(url: string, sessionId: number): Promise<PickResult> {
  const res = await request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loader_session_id: sessionId }),
  });
  if (res.ok) return { kind: "picked", run: (await res.json()) as Run };
  if (res.status === 409) {
    const d = errorBody(await res.json().catch(() => undefined));
    if (d.code === "RUN_PICKED_BY_OTHER") return { kind: "taken", pickedBy: String(d.picked_by) };
  }
  if (res.status >= 500) throw new NetworkError(`HTTP ${res.status}`);
  return { kind: "gone" };
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

const MOCK_PICKS_KEY = "waypoint-loader-mock-server-v2-picks";

/** Who picked a run on the mock server; live until they put it back or sign out. */
interface MockPick {
  loader_user_id: number;
  short_name: string;
  picked_at: string;
  live: boolean;
}

/** The seeded picks: the cards in the mock queue that say who is loading. */
function seededPicks(): Record<string, MockPick> {
  const picks: Record<string, MockPick> = {};
  for (const card of mockQueue.docks.flatMap((d) => d.runs)) {
    const user = mockUsers.find((u) => u.short_name === card.picked_by);
    if (user) picks[card.code] = { loader_user_id: user.id, short_name: user.short_name, picked_at: card.picked_at ?? mockSession.started_at, live: true };
  }
  return picks;
}

const loadMockPicks = () => readJson<Record<string, MockPick>>(MOCK_PICKS_KEY) ?? seededPicks();
const saveMockPicks = (picks: Record<string, MockPick>) => writeJson(MOCK_PICKS_KEY, picks);

/** The signed-in loader on this tablet, as the mock server sees it. */
function mockViewer(): LoaderUser | undefined {
  const id = currentSessionId();
  return id === undefined ? undefined : mockSessionUser(id);
}

/** A run's stage on the mock server: every run it lists has its truck in. */
function mockStage(status: RunStatus, pick: MockPick | undefined): RunStage {
  if (status === "gated_out") return "gated_out";
  if (status === "ready_to_depart") return "ready";
  return status === "not_started" && !pick?.live ? "at_dock" : "loading";
}

/** The pick fields a card or run read carries, for `viewer`. */
function mockPickFields(code: string, status: RunStatus, viewer?: LoaderUser) {
  const pick = loadMockPicks()[code];
  const live = pick?.live ? pick : undefined;
  return {
    stage: mockStage(status, pick),
    picked_by: live?.short_name ?? null,
    picked_at: live?.picked_at ?? null,
    picked_by_me: live !== undefined && live.loader_user_id === viewer?.id,
  };
}

/**
 * The mock server's pick lock on a write, as on the API: another loader's live
 * pick is 409 RUN_PICKED_BY_OTHER; a run this loader has not picked (or put
 * back) is 409 RUN_NOT_PICKED. The last picker's taps still land after they
 * signed out, while nobody else has picked it.
 */
function mockPickRefusal(run: Run, user: LoaderUser): TransportResponse | undefined {
  const pick = loadMockPicks()[run.code];
  const extra = { entity: "DeliveryRun", entity_id: run.code };
  if (pick?.live && pick.loader_user_id !== user.id) {
    return errorResponse(409, "RUN_PICKED_BY_OTHER", `${pick.short_name} is loading ${run.code}.`, {
      ...extra,
      picked_by: pick.short_name,
      picked_at: pick.picked_at,
    });
  }
  if (!pick || pick.loader_user_id !== user.id) {
    return errorResponse(409, "RUN_NOT_PICKED", `Pick ${run.code} before working on it.`, extra);
  }
  return undefined;
}

function mockPick(code: string, sessionId: number, take: boolean): PickResult {
  const user = mockSessionUser(sessionId);
  const known = mockQueue.docks.some((d) => d.runs.some((r) => r.code === code));
  if (!user || !known) return { kind: "gone" };
  const picks = loadMockPicks();
  const holder = picks[code];
  if (holder?.live && holder.loader_user_id !== user.id) return { kind: "taken", pickedBy: holder.short_name };
  if (take) {
    if (!holder?.live) {
      picks[code] = { loader_user_id: user.id, short_name: user.short_name, picked_at: new Date().toISOString(), live: true };
    }
  } else {
    delete picks[code];
  }
  saveMockPicks(picks);
  const run = mockServerRun(loadMockState(), code);
  return { kind: "picked", run: run && { ...run, ...mockPickFields(code, run.status, user) } };
}

const MOCK_ACTIVITY_KEY = "waypoint-loader-mock-server-v2-activity";

/** The mock server's log per run, newest first: the seeded log plus what it applied since. */
const loadMockActivity = () => readJson<Record<string, ActivityEntry[]>>(MOCK_ACTIVITY_KEY) ?? {};

function mockServerActivity(code: string): ActivityEntry[] {
  return loadMockActivity()[code] ?? mockActivity[code] ?? [];
}

type MockLogEntry = Pick<ActivityEntry, "type" | "summary"> & {
  actor: ActivityEntry["actor"];
  orderNumber?: string;
  details?: Record<string, unknown>;
};

/** Log an event the mock server applied, like LoaderService.log on the API. */
function logMockActivity(run: Run, entry: MockLogEntry) {
  const events = mockServerActivity(run.code);
  const stop = entry.orderNumber
    ? run.stops.find((s) => s.orders.some((o) => o.order_number === entry.orderNumber))
    : undefined;
  const logged: ActivityEntry = {
    id: Math.max(0, ...events.map((e) => e.id)) + 1,
    type: entry.type,
    at: new Date().toISOString(),
    actor: entry.actor,
    stop: stop ? { sequence: stop.stop_sequence, outlet_code: stop.outlet.code } : null,
    order: entry.orderNumber ? { order_number: entry.orderNumber } : null,
    summary: entry.summary,
    details: entry.details ?? {},
  };
  writeJson(MOCK_ACTIVITY_KEY, { ...loadMockActivity(), [run.code]: [logged, ...events] });
}

const loaderActor = (user?: LoaderUser): ActivityEntry["actor"] => ({
  kind: "loader",
  name: user?.short_name ?? null,
  full_name: user?.full_name ?? null,
});

// The loader's wording for each write (API_CONTRACT.md "GET /loader/runs/{code}/activity").
const ORDER_WORDS: Partial<Record<QueuedActionType, [type: string, verb: string]>> = {
  check: ["order_checked", "loaded"],
  uncheck: ["order_unchecked", "unchecked"],
  recheck: ["order_rechecked", "re-checked"],
  unload: ["order_unloaded", "unloaded"],
};

/** What the mock server logs for a write it applied to `before`. */
function mockLogEntry(before: Run, action: QueuedAction, user?: LoaderUser): MockLogEntry | undefined {
  const actor = loaderActor(user);
  const who = user?.short_name ?? "unknown loader";
  const { order_number } = action.payload as { order_number?: string };
  const order = before.stops.flatMap((s) => s.orders).find((o) => o.order_number === order_number);
  const words = ORDER_WORDS[action.action_type];
  if (words && order_number) {
    // A check that clears re_check is a re-check, as on the API.
    const [type, verb] = action.action_type === "check" && order?.state === "re_check" ? ORDER_WORDS.recheck! : words;
    if (action.action_type !== "unload") return { type, actor, orderNumber: order_number, summary: `${order_number} ${verb}` };
    const area = order?.temperature_class === "chilled" ? "chiller" : "staging";
    return { type, actor, orderNumber: order_number, summary: `${order_number} ${verb} → ${area}`, details: { return_area: area } };
  }
  switch (action.action_type) {
    case "acknowledge":
      return { type: "plan_acknowledged", actor, summary: `Acknowledged · ${who}` };
    case "flag": {
      // The seed's wording: "ORD0092314: missing 8 of 8 units, sent to Dispatcher".
      const issue = loadMockIssues().find((i) => mockIssueAction(i) === action.client_action_id);
      const what = issue
        ? `${ISSUE_TYPE_LABELS[issue.issue_type].toLowerCase()} ${issue.units_affected} of ${issue.units_total} units`
        : "flagged";
      return { type: "issue_flagged", actor, orderNumber: order_number, summary: `${order_number}: ${what}, sent to Dispatcher` };
    }
    case "release":
      return { type: "run_released", actor, summary: `Ready to depart · ${who}` };
    case "release_undo":
      return { type: "run_release_undone", actor, summary: `Ready undone · ${who}` };
    default:
      return undefined;
  }
}

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

// Row states each row write starts from (API_CONTRACT.md "Check · uncheck ·
// recheck" and "POST /loader/issues"). check also confirms a re_check row, as
// recheck does. A row already where the write would put it is a no-op; a flag
// has no no-op: a second flag on a row is refused like the server does.
const ORDER_WRITES: Partial<Record<QueuedActionType, { from: readonly OrderState[]; noop: OrderState[] }>> = {
  check: { from: ["to_load", "new", "re_check"], noop: ["loaded"] },
  uncheck: { from: ["loaded"], noop: ["to_load", "new"] },
  recheck: { from: ["re_check"], noop: ["loaded"] },
  flag: { from: FLAGGABLE_STATES, noop: [] },
};

/** The server's grace on top of the undo window, so a last-second tap over a slow link lands. */
const UNDO_GRACE_MS = 2_000;

/**
 * How the mock server answers release and undo (contract, L6): release is
 * refused while anything blocks it (409 RELEASE_LOCKED with the blockers);
 * undo only while the run is still ready (else 409 INVALID_STATE_TRANSITION)
 * and within 10 s of released_at plus 2 s grace (else 409 UNDO_WINDOW_EXPIRED).
 */
function releaseOutcome(run: Run, action: QueuedAction): TransportResponse | "noop" | undefined {
  const refuse = (code: string, message: string, extra: object = {}) =>
    errorResponse(409, code, message, { entity: "DeliveryRun", entity_id: run.code, ...extra });
  if (action.action_type === "release") {
    if (run.status === "ready_to_depart") return "noop";
    if (run.status === "gated_out") return refuse("INVALID_STATE_TRANSITION", `${run.code} is through the gate.`);
    const blockers = run.release_blockers ?? [];
    const open = run.orders_total - run.orders_checked;
    const locked = blockers.length > 0 || open > 0 || run.unacknowledged_plan_version !== null;
    if (locked) {
      return refuse("RELEASE_LOCKED", `${run.code} cannot be released yet.`, {
        release_blockers: blockers.length ? blockers : [{ code: "orders_open", count: open }],
      });
    }
  }
  if (action.action_type === "release_undo") {
    if (run.status !== "ready_to_depart") return refuse("INVALID_STATE_TRANSITION", `${run.code} is not ready to depart.`);
    if (run.released_at && Date.now() - Date.parse(run.released_at) > UNDO_WINDOW_MS + UNDO_GRACE_MS) {
      return refuse("UNDO_WINDOW_EXPIRED", "The 10 s undo window has passed.", {
        released_at: run.released_at,
        window_seconds: UNDO_WINDOW_MS / 1000,
      });
    }
  }
  return undefined;
}

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
      // POST /loader/issues returns the issue; the other writes the run.
      const isFlag = request.path === "/loader/issues";
      const ok = (current: Run | undefined): TransportResponse => ({
        status: 200,
        body: isFlag ? loadMockIssues().find((i) => mockIssueAction(i) === id) : current,
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

      // Every write needs a signed-in loader who holds the run (a replay already answered above).
      const sessionId = request.body.loader_session_id ?? null;
      if (sessionId === null) {
        return errorResponse(422, "VALIDATION_ERROR", "loader_session_id is required.");
      }
      const sessionUser = mockSessionUser(Number(sessionId));
      if (!sessionUser) {
        return errorResponse(404, "NOT_FOUND", `Loader session ${String(sessionId)} not found.`, {
          entity: "LoaderSession",
          entity_id: sessionId,
        });
      }
      const refusal = mockPickRefusal(run, sessionUser);
      if (refusal) return refusal;

      const sent = Number(request.body.plan_version);
      if (sent !== run.current_plan_version) {
        return errorResponse(
          409,
          "PLAN_VERSION_STALE",
          `Plan changed to v${run.current_plan_version}; this action was made on v${sent}.`,
          { entity: "DeliveryRun", entity_id: run.code, current_plan_version: run.current_plan_version, sent_plan_version: sent },
        );
      }

      // L7: row writes wait for the acknowledgement (a replay already answered above).
      if (ORDER_WRITES[action.action_type] || action.action_type === "unload") {
        if (run.unacknowledged_plan_version !== null) {
          return errorResponse(409, "PLAN_NOT_ACKNOWLEDGED", `Plan v${run.unacknowledged_plan_version} has not been acknowledged.`, {
            entity: "DeliveryRun",
            entity_id: run.code,
            unacknowledged_plan_version: run.unacknowledged_plan_version,
          });
        }
      }

      const release = releaseOutcome(run, action);
      if (release === "noop") return ok(run);
      if (release) return release;

      const outcome = orderWriteOutcome(run, action);
      if (outcome === "noop") return ok(run);
      if (outcome) return outcome;

      // The server records who checked from the session (an ended one is still
      // accepted: offline taps replay after sign-out).
      const by = sessionUser.short_name;
      state[run.code] = applyAction(run, action, by, sessionUser?.id);
      if (isFlag) {
        const issues = [...loadMockIssues(), newMockIssue(run, request.body as unknown as FlagActionPayload, id, by)];
        saveMockIssues(issues);
        state[run.code] = withIssueLock(state[run.code], issues);
      }
      // After the flag block, so a flag's log line can read the issue it created.
      const logged = mockLogEntry(run, action, sessionUser);
      if (logged) logMockActivity(state[run.code], logged);
      ids[id] = signature;
      saveMockState(state);
      saveMockIds(ids);
      return ok(state[run.code]);
    },
    async fetchRun(code) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      const run = mockServerRun(loadMockState(), code);
      if (!run) return undefined;
      const viewer = mockViewer();
      const pick = mockPickFields(code, run.status, viewer);
      if (pick.picked_by && !pick.picked_by_me) throw new RunPickedError(pick.picked_by);
      return { ...run, stage: pick.stage, picked_by: pick.picked_by, picked_at: pick.picked_at };
    },
    async pickRun(code, sessionId) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return mockPick(code, sessionId, true);
    },
    async unpickRun(code, sessionId) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return mockPick(code, sessionId, false);
    },
    async fetchActivity(code) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      if (!mockServerRun(loadMockState(), code)) return undefined;
      return mockServerActivity(code);
    },
    async fetchQueue() {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return mockServerQueue();
    },
    async fetchSummary() {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return mockServerSummary(mockServerQueue());
    },
    async fetchIssues({ run }) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return loadMockIssues()
        .filter((i) => !run || i.run_code === run)
        .sort((a, b) => b.reported_at.localeCompare(a.reported_at));
    },
    async fetchIssue(id) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return loadMockIssues().find((i) => i.id === id);
    },
    async uploadIssuePhoto(clientActionId, photo) {
      if (!(await probeConnectivity())) throw new NetworkError();
      const issues = loadMockIssues();
      if (!issues.some((i) => i.client_action_id === clientActionId)) return "not_found";
      // No storage behind the mock: keep the photo on the issue as a data URL.
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(photo);
      });
      saveMockIssues(
        issues.map((i) =>
          i.client_action_id === clientActionId && !i.photo_path ? { ...i, photo_path: dataUrl, photo_url: dataUrl } : i,
        ),
      );
      return "ok";
    },
    async fetchUsers() {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return mockUsers;
    },
    async startSession({ loader_user_id, pin, depot }) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      const user = mockUsers.find((u) => u.id === loader_user_id);
      if (!user || mockUserPins[user.id] !== pin) return undefined;
      // Every mock loader works at the mock session's depot.
      if (depot !== mockSession.depot) throw new SignInRefusedError(`${user.short_name} works at another depot.`);

      const rows = loadMockSessions();
      const id = Math.max(mockSession.session_id, ...Object.keys(rows).map(Number)) + 1;
      rows[id] = { loader_user_id: user.id };
      saveMockSessions(rows);
      return {
        session_id: id,
        loader: { id: user.id, short_name: user.short_name },
        dock: null,
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
      // The lock lifts with the session; the loader stays the last picker.
      const user = mockSessionUser(sessionId);
      const picks = loadMockPicks();
      for (const pick of Object.values(picks)) if (pick.loader_user_id === user?.id) pick.live = false;
      saveMockPicks(picks);
    },
  };
}

// ---- Mock issues ----------------------------------------------------------

const MOCK_ISSUES_KEY = "waypoint-loader-mock-server-v2-issues";

interface StoredMockIssue extends LoaderIssue {
  /** The flag's client_action_id, so a replay answers with the same issue. */
  client_action_id?: string;
  /** The flag photo (a data URL in the mock), as IssueDetailRead.photo_url. */
  photo_url?: string | null;
}

/** Issues on the mock server: the seeded ones, then any flagged in this browser. */
function loadMockIssues(): StoredMockIssue[] {
  return readJson<StoredMockIssue[]>(MOCK_ISSUES_KEY) ?? mockIssues;
}

function saveMockIssues(issues: StoredMockIssue[]) {
  writeJson(MOCK_ISSUES_KEY, issues);
}

const mockIssueAction = (issue: LoaderIssue) => (issue as StoredMockIssue).client_action_id;

const WAITING = (issue: LoaderIssue) => issue.status === "sent" || issue.status === "seen";

/** The Dispatcher's choices for a new flag; the first is the default. */
function mockOptions(type: LoaderIssue["issue_type"], affected: number, total: number): IssueOption[] {
  const option = (label: string, detail: string, isDefault = false): IssueOption => ({
    label,
    detail,
    is_default: isDefault,
    is_chosen: false,
  });
  switch (type) {
    case "missing":
      return [option("Send without it", "Defer it to the next delivery day.", true), option("Hold the vehicle", "Wait for the order to be found.")];
    case "wont_fit":
      return [
        option("Leave the overflow for the next run", `${affected} units wait at the dock.`, true),
        option("Swap to a larger vehicle", "Reload on a bigger truck."),
      ];
    default:
      return [
        option(`Send ${total - affected} of ${total}`, "Balance on the next delivery day.", true),
        option("Hold the vehicle", "Wait for replacement stock."),
      ];
  }
}

function newMockIssue(run: Run, flag: FlagActionPayload, clientActionId: string, by?: string): StoredMockIssue {
  const stop = run.stops.find((s) => s.orders.some((o) => o.order_number === flag.order_number));
  const order = stop?.orders.find((o) => o.order_number === flag.order_number);
  const total = order?.units ?? flag.units_affected;
  const ids = loadMockIssues().map((i) => i.id);
  return {
    id: Math.max(100, ...ids) + 1,
    run_code: run.code,
    order_number: flag.order_number,
    outlet_code: stop?.outlet.code ?? "",
    issue_type: flag.issue_type,
    units_affected: flag.units_affected,
    units_total: total,
    quick_note_tag: flag.quick_note_tag,
    note: flag.note || null,
    photo_path: null,
    reported_by: by ?? "Unknown loader",
    reported_at: new Date().toISOString(),
    status: "sent",
    seen_at: null,
    // Contract: departure − 20 min.
    decide_by: new Date(Date.parse(run.departs_at) - 20 * 60_000).toISOString(),
    decided_at: null,
    decided_by: null,
    options: mockOptions(flag.issue_type, flag.units_affected, total),
    client_action_id: clientActionId,
  };
}

/**
 * The run's issue_waiting blocker and status from its open issues: waiting
 * issues keep it issue_flagged; once all are answered it goes back to
 * loading or loaded (the Dispatcher's decision clears it, per L4).
 */
function withIssueLock(run: Run, issues: LoaderIssue[]): Run {
  const waiting = issues.filter((i) => i.run_code === run.code && WAITING(i)).length;
  const others = (run.release_blockers ?? []).filter((b) => b.code !== "issue_waiting");
  const blockers = waiting > 0 ? [...others, { code: "issue_waiting" as const, count: waiting }] : others;
  const status =
    waiting > 0
      ? "issue_flagged"
      : run.status === "issue_flagged"
        ? run.orders_total > 0 && run.orders_checked === run.orders_total
          ? "loaded"
          : "loading"
        : run.status;
  return { ...run, status, release_blockers: blockers, release_locked: blockers.length > 0 };
}

/** Mock transport only, for the dev kit: the newest issue still waiting on the Dispatcher. */
export function newestWaitingMockIssue(): LoaderIssue | undefined {
  return loadMockIssues()
    .filter(WAITING)
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at))[0];
}

/**
 * Mock transport only, for the dev kit: what POST /loader/dev/issues/{id}/decide
 * (optionLabel) or …/expire (no label: the default is applied) does on the API.
 */
export function decideMockIssue(id: number, optionLabel?: string): LoaderIssue | undefined {
  const issues = loadMockIssues();
  const issue = issues.find((i) => i.id === id);
  if (!issue || !WAITING(issue)) return issue;
  const chosen = optionLabel ?? issue.options.find((o) => o.is_default)?.label;
  const now = new Date().toISOString();
  const decided: StoredMockIssue = {
    ...issue,
    status: optionLabel ? "decided" : "default_applied",
    seen_at: issue.seen_at ?? now,
    decided_at: now,
    decided_by: optionLabel ? "Kasun P." : null,
    options: issue.options.map((o) => ({ ...o, is_chosen: o.label === chosen })),
  };
  const next = issues.map((i) => (i.id === id ? decided : i));
  saveMockIssues(next);
  const state = loadMockState();
  const run = mockServerRun(state, issue.run_code);
  if (run) {
    state[run.code] = withIssueLock(run, next);
    saveMockState(state);
  }
  return decided;
}

/**
 * The mock queue with each run the mock server holds in detail (RUN-021)
 * brought up to date: status, counts, and the plan-change alert while a new
 * plan is unread. The other runs are queue-level only.
 */
function mockServerQueue(): RunQueue {
  const state = loadMockState();
  const viewer = mockViewer();
  return {
    ...mockQueue,
    docks: mockQueue.docks.map((group) => ({
      ...group,
      runs: group.runs
        .map((plain): RunSummary => {
          const card = { ...plain, ...mockPickFields(plain.code, plain.status, viewer) };
          const run = mockServerRun(state, card.code);
          // Queue-only runs have no detail on the mock server: keep the alert
          // text but drop its Open action, which would only reach a dead end.
          if (!run) return card.alert ? { ...card, alert: { ...card.alert, action: "", href: "" } } : card;
          return {
            ...card,
            ...mockPickFields(card.code, run.status, viewer),
            status: run.status,
            stop_count: run.stops.length,
            orders_loaded: run.orders_loaded,
            orders_checked: run.orders_checked,
            orders_total: run.orders_total,
            alert: planChangeAlert(run) ?? (card.alert?.tone === "warning" ? null : card.alert),
          };
        })
        // Through the gate, a run drops off the queue.
        .filter((card) => card.status !== "gated_out"),
    })),
  };
}

const LOADING: RunStatus[] = ["loading", "issue_flagged", "loaded"];

/** The mock summary, counted from the mock queue so the two agree. */
function mockServerSummary(queue: RunQueue): QueueSummary {
  const runs = queue.docks.flatMap((d) => d.runs);
  const loading = runs.filter((r) => r.stage === "loading" || LOADING.includes(r.status));
  const ready = runs.filter((r) => r.status === "ready_to_depart");
  return {
    ...mockSummary,
    runs: runs.length,
    loading: {
      count: loading.length,
      loaders: [...new Set(loading.flatMap((r) => {
        const name = r.picked_by ?? r.loader;
        return name ? [name.split(" ")[0]] : [];
      }))],
    },
    ready: { count: ready.length, run_codes: ready.map((r) => r.code) },
    // Open flags on the mock server, so a new flag shows on the Issues badge.
    issues: { count: loadMockIssues().filter(WAITING).length, label: mockSummary.issues.label },
    plan_updated_at: dockPlanUpdatedAt(runs.map((r) => r.code)),
  };
}

/** Latest current-plan publish among the queue's runs the mock server holds in detail; null if none. */
function dockPlanUpdatedAt(codes: string[]): string | null {
  const state = loadMockState();
  const times = codes.flatMap((code) => {
    const run = mockServerRun(state, code);
    return run ? [run.plan.published_at] : [];
  });
  return times.sort().at(-1) ?? null;
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
  const now = new Date().toISOString();
  // The diff reads from the plan last confirmed (contract "Plan diff").
  const confirmed =
    run.unacknowledged_plan_version === null
      ? run.current_plan_version
      : (run.acknowledged_plan_version ?? run.current_plan_version - 1);
  const wasReady = run.status === "ready_to_depart";
  let marked = false;
  const next = withRecomputedCounts({
    ...run,
    current_plan_version: version,
    unacknowledged_plan_version: version,
    acknowledged_plan_version: confirmed,
    plan: { ...run.plan, version, published_at: now, acknowledged_at: null, acknowledged_by: null },
    plan_change: {
      from_version: confirmed,
      to_version: version,
      published_at: now,
      summary: "Simulated plan change (dev kit).",
      planned_weight_before_kg: run.capacity.planned_weight_kg,
      planned_weight_after_kg: run.capacity.planned_weight_kg,
      planned_volume_before_m3: run.capacity.planned_volume_m3,
      planned_volume_after_m3: run.capacity.planned_volume_m3,
      checks_saved: run.orders_loaded,
      was_ready_at: wasReady ? now : null,
    },
    // Runs cached before L7 get the release lock from here on.
    release_blockers: run.release_blockers ?? [],
    stops: run.stops.map((stop) => ({
      ...stop,
      orders: stop.orders.map((order) => {
        if (marked || order.state !== "loaded") return order;
        marked = true;
        return { ...order, state: "re_check" as const, changed_in_version: version };
      }),
    })),
  });
  // A new plan reopens a Ready or fully loaded run (L7).
  const reopened = wasReady || (run.status === "loaded" && next.orders_checked < next.orders_total);
  state[code] = { ...next, status: reopened ? "loading" : run.status };
  saveMockState(state);
  logMockActivity(state[code], {
    type: "plan_published",
    actor: { kind: "dispatcher", name: "Dispatcher", full_name: null },
    summary: `Dispatcher published plan v${version}`,
  });
  if (wasReady) {
    logMockActivity(state[code], {
      type: "load_reopened",
      actor: { kind: "system", name: "System", full_name: null },
      summary: `Load reopened · plan changed after Ready · v${run.current_plan_version} -> v${version}`,
    });
  }
  return state[code];
}

export function createTransport(): Transport {
  return process.env.NEXT_PUBLIC_LOADER_TRANSPORT === "api"
    ? apiTransport(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000")
    : mockTransport();
}
