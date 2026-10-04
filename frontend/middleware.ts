import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Route protection for /admin
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const token = request.cookies.get("waypoint_access_token")?.value;

    // 1. Missing access token: redirect to login with return target
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname + search);
      return NextResponse.redirect(loginUrl);
    }

    // 2. Validate token structure & expiration
    try {
      const parts = token.split(".");
      if (parts.length >= 2) {
        const base64Url = parts[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = atob(base64);
        const payload = JSON.parse(jsonPayload);
        const nowSec = Math.floor(Date.now() / 1000);

        if (payload?.exp && payload.exp < nowSec) {
          // Token expired: clear cookie and redirect to login
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("redirect", pathname + search);
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete("waypoint_access_token");
          return response;
        }
      }
    } catch {
      // Malformed token: redirect to login
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect", pathname + search);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete("waypoint_access_token");
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
  ],
};
