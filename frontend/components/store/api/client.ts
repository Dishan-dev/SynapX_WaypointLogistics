import { API_URL } from "@/components/store/api/config";

/** An error from the Waypoint API, with the backend's rule code when there is one (e.g. CUTOFF_PASSED). */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the request never reached the server (offline, server down). */
  get isNetworkError() {
    return this.status === 0;
  }
}

function messageFrom(detail: unknown, fallback: string) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc, msg }]
    const first = detail[0] as { msg?: string } | undefined;
    return first?.msg ?? fallback;
  }
  if (detail && typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message);
  }
  return fallback;
}

const CANDIDATE_URLS = [
  API_URL,
  "http://localhost:8000",
  "http://localhost:5000",
].filter(Boolean);

let activeBaseUrl: string = API_URL;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response | null = null;
  const urlsToTry = Array.from(new Set([activeBaseUrl, ...CANDIDATE_URLS]));

  for (const baseUrl of urlsToTry) {
    try {
      response = await fetch(`${baseUrl}/api/v1${path}`, {
        ...init,
        headers: { "Content-Type": "application/json", ...init.headers },
        cache: "no-store",
      });
      activeBaseUrl = baseUrl;
      break;
    } catch {
      // Try next candidate
    }
  }

  if (!response) {
    throw new ApiError("Couldn't reach the Waypoint server. Check your connection and try again.", 0);
  }

  if (!response.ok) {
    let detail: unknown;
    try {
      detail = (await response.json()).detail;
    } catch {
      detail = undefined;
    }
    const code = detail && typeof detail === "object" && "code" in detail ? String((detail as { code: unknown }).code) : undefined;
    const details = detail && typeof detail === "object" && !Array.isArray(detail) ? (detail as Record<string, unknown>) : {};
    throw new ApiError(messageFrom(detail, `Request failed (${response.status})`), response.status, code, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
