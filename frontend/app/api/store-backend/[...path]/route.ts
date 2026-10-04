import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function forward(request: NextRequest) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) {
    return Response.json({ detail: "Waypoint API is not configured" }, { status: 503 });
  }

  // Keep the path and query string intact, including a catalogue trailing slash.
  const path = request.nextUrl.pathname.replace(/^\/api\/store-backend/, "/api/v1");
  const target = `${apiUrl}${path}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of ["authorization", "content-type", "accept"] as const) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("content-type", contentType);
    responseHeaders.set("cache-control", "no-store");
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ detail: "Waypoint API is unavailable" }, { status: 502 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
