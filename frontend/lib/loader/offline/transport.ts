// How queued actions reach the server. The mock transport stands in until the
// /loader write endpoints exist; set NEXT_PUBLIC_LOADER_TRANSPORT=api to use
// the real API at NEXT_PUBLIC_API_URL.

import { findMockRun } from "../mock-data";
import type { ActionRequest } from "./outbox";

export interface TransportResponse {
  status: number;
  body?: unknown;
}

export interface Transport {
  /** Throws NetworkError when the server cannot be reached. */
  send(request: ActionRequest): Promise<TransportResponse>;
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
  return {
    async send({ method, path, body }) {
      let res: Response;
      try {
        res = await fetch(`${baseUrl}/api/v1${path}`, {
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
  };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Behaves like the agreed API: needs a reachable server, answers a replayed
 * client_action_id with the original result, and returns 409 when the action
 * was made against an older plan version than the run now has.
 */
export function mockTransport(latencyMs = 300): Transport {
  const seen = new Map<string, TransportResponse>();
  return {
    async send({ body }) {
      if (!(await probeConnectivity())) throw new NetworkError();
      await new Promise((r) => setTimeout(r, latencyMs));

      const id = String(body.client_action_id);
      const replay = seen.get(id);
      if (replay) return replay;

      const run = findMockRun(String(body.run_code));
      const response: TransportResponse =
        run && Number(body.plan_version) < run.plan_version
          ? { status: 409, body: { detail: `Plan changed to v${run.plan_version}` } }
          : { status: 200, body: { client_action_id: id } };
      seen.set(id, response);
      return response;
    },
  };
}

export function createTransport(): Transport {
  return process.env.NEXT_PUBLIC_LOADER_TRANSPORT === "api"
    ? apiTransport(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000")
    : mockTransport();
}
