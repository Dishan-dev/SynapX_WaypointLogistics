import { NextRequest, NextResponse } from "next/server";
import { getKeycloakConfig } from "@/lib/keycloak";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, code_verifier, redirect_uri, refresh_token, grant_type } = body;

    const { clientId, tokenEndpoint } = getKeycloakConfig();

    const params = new URLSearchParams();
    params.set("client_id", clientId);

    if (grant_type === "refresh_token" || refresh_token) {
      params.set("grant_type", "refresh_token");
      params.set("refresh_token", refresh_token);
    } else {
      if (!code || !code_verifier || !redirect_uri) {
        return NextResponse.json({ error: "invalid_request", error_description: "Missing authorization code, PKCE verifier, or redirect URI" }, { status: 400 });
      }
      if (redirect_uri !== new URL("/auth/callback", req.url).toString()) {
        return NextResponse.json({ error: "invalid_request", error_description: "Invalid redirect URI" }, { status: 400 });
      }
      params.set("grant_type", "authorization_code");
      params.set("code", code);
      params.set("redirect_uri", redirect_uri);
      if (code_verifier) {
        params.set("code_verifier", code_verifier);
      }
    }

    const kcRes = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: params.toString(),
      cache: "no-store",
    });

    const data = await kcRes.json();

    if (!kcRes.ok) {
      return NextResponse.json(
        {
          error: data.error || "token_exchange_failed",
          error_description: data.error_description || "Keycloak rejected token exchange",
        },
        { status: kcRes.status }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal auth server error";
    return NextResponse.json(
      { error: "server_error", error_description: message },
      { status: 500 }
    );
  }
}
