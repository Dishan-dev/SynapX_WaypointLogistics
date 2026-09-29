// Loader service worker (scope /loader). Keeps the loader app shell usable
// when the dock tablet loses its connection. Run data and queued writes live
// in IndexedDB (lib/loader/offline), not here.
//
// Loader-only for now; to be merged into the team PWA-0 worker later.

const VERSION = "loader-v1";
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
const PRECACHE = ["/loader", "/loader.webmanifest", "/loader-icons/icon-192.png", "/loader-icons/icon-512.png"];

// Cache the shell pages plus the build assets the queue page references, so
// the app opens offline even on the first visit after install.
async function precache() {
  const pages = await caches.open(PAGES);
  await pages.addAll(PRECACHE);
  const shell = await pages.match("/loader");
  if (!shell) return;
  const html = await shell.text();
  const assets = [...new Set(html.match(/\/_next\/static\/[\w\-.\/~%]+/g) || [])];
  const statics = await caches.open(STATIC);
  await Promise.all(assets.map((url) => statics.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("loader-") && !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Network first; on failure use the cached copy (for pages, fall back to the
// cached queue so the shell still opens).
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) return fallback;
    }
    throw err;
  }
}

// Build output under /_next/static is content-hashed, so cache first is safe.
async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Connectivity probes and API calls must always hit the network.
  if (url.searchParams.has("probe") || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/loader-icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  const isLoaderPath = url.pathname === "/loader" || url.pathname.startsWith("/loader/");
  if (request.mode === "navigate" && isLoaderPath) {
    event.respondWith(networkFirst(request, "/loader"));
    return;
  }
  // Client-side navigation data (RSC payloads) and the manifest.
  if (isLoaderPath || url.pathname === "/loader.webmanifest") {
    event.respondWith(networkFirst(request));
  }
});
