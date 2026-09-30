// Loader service worker (scope /loader). Keeps the loader app shell usable
// when the dock tablet loses its connection. Run data and queued writes live
// in IndexedDB (lib/loader/offline), not here.
//
// Loader-only for now; to be merged into the team PWA-0 worker later.

// v2: adds the sign-in and More pages (sign-in and sign-out work offline).
// v3: adds the Issues tab.
// v4: run pages (checklist, review, ready, log) go in their own cache, which
//     the tablet empties on sign-out so the next loader cannot open them offline.
const VERSION = "loader-v4";
const PAGES = `${VERSION}-pages`;
const STATIC = `${VERSION}-static`;
// Name must end in "-runs": lib/loader/offline/run-pages.ts clears caches by that suffix.
const RUNS = `${VERSION}-runs`;
const PRECACHE = ["/loader", "/loader/sign-in", "/loader/more", "/loader/issues", "/loader.webmanifest", "/loader-icons/icon-192.png", "/loader-icons/icon-512.png"];

// Cache the shell pages plus the build assets the queue, sign-in, More and
// Issues pages reference, so the app opens offline even on the first visit after install.
const SHELL_PAGES = ["/loader", "/loader/sign-in", "/loader/more", "/loader/issues"];

async function precache() {
  const pages = await caches.open(PAGES);
  await pages.addAll(PRECACHE);
  const html = (
    await Promise.all(SHELL_PAGES.map(async (url) => (await pages.match(url))?.text() ?? ""))
  ).join(" ");
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
// cached queue so the shell still opens). Pages match without their query
// (?next=, ?reason=): the page is the same, and sign-in reads it client-side.
async function networkFirst(request, fallbackUrl, cacheName = PAGES) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === "navigate" });
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await (await caches.open(PAGES)).match(fallbackUrl);
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
  // A run's pages and their navigation data: kept apart so sign-out can drop them.
  const cacheName = url.pathname.startsWith("/loader/runs/") ? RUNS : PAGES;
  if (request.mode === "navigate" && isLoaderPath) {
    event.respondWith(networkFirst(request, "/loader", cacheName));
    return;
  }
  // Client-side navigation data (RSC payloads) and the manifest.
  if (isLoaderPath || url.pathname === "/loader.webmanifest") {
    event.respondWith(networkFirst(request, undefined, cacheName));
  }
});
