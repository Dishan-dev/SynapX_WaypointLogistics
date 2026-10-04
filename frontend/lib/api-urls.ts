/** Local port discovery is useful during development, but a hosted browser's
 * localhost is the visitor's machine, never the Waypoint API. */
export function apiBaseUrls(configuredUrl: string | undefined): string[] {
  const urls = configuredUrl?.trim() ? [configuredUrl.trim().replace(/\/$/, "")] : [];
  const local =
    typeof window === "undefined"
      ? !process.env.VERCEL_ENV
      : ["localhost", "127.0.0.1"].includes(window.location.hostname);

  if (local) urls.push("http://localhost:8000", "http://localhost:5000");
  return Array.from(new Set(urls));
}
