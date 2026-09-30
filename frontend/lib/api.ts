/**
 * Resilient API client for Waypoint Logistics
 * Automatically resolves between port 8000 (uvicorn default) and port 5000 (custom port)
 */
import { getToken } from "./auth";

const CANDIDATE_API_URLS = [
  process.env.NEXT_PUBLIC_API_URL,
  "http://localhost:8000",
  "http://localhost:5000",
].filter(Boolean) as string[];

let cachedApiUrl: string | null = null;

export async function getActiveApiUrl(): Promise<string> {
  if (cachedApiUrl) return cachedApiUrl;

  for (const url of Array.from(new Set(CANDIDATE_API_URLS))) {
    try {
      const res = await fetch(`${url}/api/v1/health`, {
        signal: AbortSignal.timeout(1200),
        cache: "no-store",
      });
      if (res.ok) {
        cachedApiUrl = url;
        return url;
      }
    } catch {
      // Try next candidate
    }
  }

  // Fallback to configured or default
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export async function fetchWithFallback(
  endpoint: string,
  init?: RequestInit
): Promise<Response> {
  const urlsToTry = Array.from(
    new Set([
      cachedApiUrl,
      process.env.NEXT_PUBLIC_API_URL,
      "http://localhost:8000",
      "http://localhost:5000",
    ].filter(Boolean) as string[])
  );

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  let lastError: unknown = null;

  for (const baseUrl of urlsToTry) {
    try {
      const res = await fetch(`${baseUrl}${cleanEndpoint}`, init);
      // If we got any response (even 4xx/5xx), the server is alive on this port
      cachedApiUrl = baseUrl;
      return res;
    } catch (err) {
      lastError = err;
      // Network/connection error: continue to next port candidate
    }
  }

  throw lastError || new Error("Failed to connect to backend on either port 8000 or 5000");
}

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  
  // ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  // attach api/v1 prefix as fetchWithFallback takes the whole endpoint
  const endpoint = `api/v1${normalizedPath}`;

  const res = await fetchWithFallback(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    let errorMsg = `HTTP Error ${res.status}`;
    try {
      const errorData = await res.json();
      errorMsg = errorData.detail || JSON.stringify(errorData);
    } catch {
      errorMsg = await res.text() || errorMsg;
    }
    throw new ApiError(errorMsg);
  }
  
  return res.json();
}
