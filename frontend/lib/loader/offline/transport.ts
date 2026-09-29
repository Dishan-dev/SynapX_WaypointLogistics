// How the tablet talks to the server: queued writes and run refetches. The
// mock transport stands in until the /loader endpoints are wired up; set
// NEXT_PUBLIC_LOADER_TRANSPORT=api to use the real API at NEXT_PUBLIC_API_URL.

import { findMockRun, mockSession } from "../mock-data";
import type { QueuedAction, QueuedActionType, Run } from "../types";
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
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---- Mock server -------------------------------------------------------

const MOCK_STATE_KEY = "waypoint-loader-mock-server";

/** The mock "server" copy of each run, kept across reloads in this browser. */
function loadMockState(): Record<string, Run> {
  try {
    return JSON.parse(window.localStorage.getItem(MOCK_STATE_KEY) ?? "{}") as Record<string, Run>;
  } catch {
    return {};
  }
}

function saveMockState(state: Record<string, Run>) {
  try {
    window.localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked: the mock server simply forgets on reload.
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
  const order = /^\/loader\/runs\/([^/]+)\/orders\/([^/]+)\/(check|unload)$/.exec(path);
  if (order) {
    const type: QueuedActionType = order[3] === "unload" ? "unload" : method === "DELETE" ? "uncheck" : "check";
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

/**
 * Behaves like the write contract: needs a reachable server, answers a
 * replayed client_action_id with the original result and 200, and applies
 * each write to its own copy of the run so GET /loader/runs/{code} returns
 * the server's view (including writes from other tablets in this browser).
 */
export function mockTransport(latencyMs = 300): Transport {
  const seen = new Map<string, TransportResponse>();
  const serverRun = (state: Record<string, Run>, code: string) => state[code] ?? findMockRun(code);

  return {
    async send(request) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));

      const id = String(request.body.client_action_id);
      const replay = seen.get(id);
      if (replay) return replay;

      const state = loadMockState();
      const code = /^\/loader\/runs\/([^/]+)/.exec(request.path)?.[1] ?? String(request.body.run_code);
      const run = serverRun(state, decodeURIComponent(code));
      const action = run && actionFromRequest(request, run.current_plan_version);
      if (run && action) {
        // The server records who checked from the session; the mock knows one.
        const by = request.body.loader_session_id === mockSession.session_id ? mockSession.loader.short_name : undefined;
        state[run.code] = applyAction(run, action as QueuedAction, by);
        saveMockState(state);
      }

      const response: TransportResponse = { status: 200, body: { client_action_id: id } };
      seen.set(id, response);
      return response;
    },
    async fetchRun(code) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));
      return serverRun(loadMockState(), code);
    },
  };
}

export function createTransport(): Transport {
  return process.env.NEXT_PUBLIC_LOADER_TRANSPORT === "api"
    ? apiTransport(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000")
    : mockTransport();
}
