import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL?.trim().replace(/\/$/, "") || "";
  const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM?.trim() || "";
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") || "";

  // Results payload
  const result = {
    keycloak: {
      status: "offline" as "online" | "offline",
      latency: 0,
      url: keycloakUrl,
      realm: keycloakRealm,
      error: undefined as string | undefined,
    },
    backend: {
      status: "offline" as "online" | "offline",
      latency: 0,
      url: `${apiUrl}/api/v1`,
      version: undefined as string | undefined,
      error: undefined as string | undefined,
    },
    database: {
      status: "offline" as "online" | "offline" | "unknown",
      provider: "Neon Serverless PostgreSQL",
      details: undefined as string | undefined,
    },
    bridge: {
      status: "disconnected" as "connected" | "disconnected",
    },
    timestamp: new Date().toISOString(),
  };

  // 1. Probe Keycloak OIDC
  const kcStart = Date.now();
  if (!keycloakUrl || !keycloakRealm) {
    result.keycloak.error = "Keycloak environment variables are not configured";
  } else try {
    const kcRes = await fetch(
      `${keycloakUrl}/realms/${keycloakRealm}/.well-known/openid-configuration`,
      {
        signal: AbortSignal.timeout(4000),
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
    result.keycloak.latency = Date.now() - kcStart;
    if (kcRes.ok) {
      result.keycloak.status = "online";
    } else {
      result.keycloak.status = "offline";
      result.keycloak.error = `HTTP ${kcRes.status}: ${kcRes.statusText}`;
    }
  } catch (err: unknown) {
    result.keycloak.status = "offline";
    result.keycloak.error = err instanceof Error ? err.message : "Connection failed";
  }

  // 2. Probe the configured FastAPI backend only.
  const candidateUrls = apiUrl ? [apiUrl] : [];

  let backendConnected = false;
  let lastBackendError = apiUrl ? "Server offline" : "NEXT_PUBLIC_API_URL is not configured";

  for (const targetUrl of candidateUrls) {
    const beStart = Date.now();
    try {
      const beRes = await fetch(`${targetUrl}/api/v1/health`, {
        // The health endpoint also checks the database, which can take a few
        // seconds to establish a connection after an idle period.
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (beRes.ok) {
        const beData = await beRes.json();
        result.backend.latency = Date.now() - beStart;
        result.backend.status = "online";
        result.backend.url = `${targetUrl}/api/v1`;
        result.backend.version = beData.version || "1.0.0";
        result.bridge.status = "connected";

        if (beData.database === "connected") {
          result.database.status = "online";
          result.database.details = "Active pooled connection verified (SELECT 1)";
        } else {
          result.database.status = "offline";
          result.database.details = beData.database || "Database query failed";
        }
        backendConnected = true;
        break;
      } else {
        lastBackendError = `HTTP ${beRes.status} from backend`;
      }
    } catch (err: unknown) {
      lastBackendError = err instanceof Error ? err.message : `Connection refused at ${targetUrl}`;
    }
  }

  if (!backendConnected) {
    result.backend.status = "offline";
    result.backend.error = lastBackendError;
    result.database.status = "unknown";
    result.database.details = "Cannot inspect DB while backend is down";
    result.bridge.status = "disconnected";
  }

  return NextResponse.json(result);
}
