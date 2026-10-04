import { NextRequest, NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth";
import { getKeycloakConfig } from "@/lib/keycloak";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const refreshToken = body.refresh_token;

    const { clientId, logoutEndpoint } = getKeycloakConfig();

    // Attempt backchannel revocation in Keycloak if refresh token is present
    if (refreshToken) {
      try {
        await fetch(logoutEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            refresh_token: refreshToken,
          }).toString(),
          cache: "no-store",
        });
      } catch (kcErr) {
        console.warn("Backchannel Keycloak logout notice:", kcErr);
      }
    }

    const response = NextResponse.json({ success: true });

    // Explicitly delete cookie across root path
    response.cookies.set(ACCESS_TOKEN_COOKIE, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      sameSite: "lax",
    });
    response.cookies.delete(ACCESS_TOKEN_COOKIE);

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Logout error";
    const response = NextResponse.json({ success: false, error: message }, { status: 500 });
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    return response;
  }
}
