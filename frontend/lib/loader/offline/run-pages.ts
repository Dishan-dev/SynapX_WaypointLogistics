// A run's Review, Ready and Log pages are server-rendered per run, so the
// service worker (public/loader-sw.js) can only keep them once they have been
// fetched. While a checklist is open online, the tablet fetches them so they
// open offline later. They are kept in the worker's "-runs" cache, which
// sign-out empties: on a shared tablet the next loader must not open the
// previous loader's pages offline.

import { clearCachedActivity } from "./db";

/** The pages fetched ahead for a run, relative to its checklist. */
const WARM_PAGES = ["review", "ready", "log"];

/** Must match the RUNS cache name in public/loader-sw.js ("loader-v4-runs"). */
const isRunCache = (name: string) => name.startsWith("loader-") && name.endsWith("-runs");

/** Build files a page's HTML references; the worker keeps these in its static cache. */
const assetUrls = (html: string) => html.match(/\/_next\/static\/[\w\-.\/~%]+/g) ?? [];

/**
 * Fetch a run's Review, Ready and Log pages, and the build files their HTML
 * references, so the service worker caches them (a page without its script
 * chunks cannot open offline). Only worth doing while the worker controls
 * the page; failures are ignored (the pages simply stay online-only).
 */
export async function warmRunPages(code: string): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.serviceWorker?.controller) return;
  const base = `/loader/runs/${encodeURIComponent(code)}`;
  const pages = await Promise.all(
    WARM_PAGES.map((page) =>
      fetch(`${base}/${page}`, { credentials: "same-origin" })
        .then((res) => (res.ok ? res.text() : ""))
        .catch(() => ""),
    ),
  );
  const assets = [...new Set(pages.flatMap(assetUrls))];
  await Promise.all(assets.map((url) => fetch(url).catch(() => undefined)));
}

/** Drop every cached run page (checklist, review, ready, log and their navigation data). */
export async function clearRunPages(): Promise<void> {
  if (typeof caches === "undefined") return;
  const names = await caches.keys();
  await Promise.all(names.filter(isRunCache).map((name) => caches.delete(name)));
}

/**
 * What a signed-in loader leaves on the tablet and sign-out removes: the saved
 * run logs and the cached run pages. The outbox, the run copies it replays
 * against, and the queue are kept, so writes queued offline still go out.
 */
export async function clearSessionCaches(): Promise<void> {
  await Promise.all([clearCachedActivity().catch(() => {}), clearRunPages().catch(() => {})]);
}
