"use client";

import * as React from "react";

const ENABLED =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_LOADER_SW === "1";

/**
 * Registers the loader service worker. Off in `next dev` (it would cache
 * hot-reload chunks) unless NEXT_PUBLIC_LOADER_SW=1.
 */
export function LoaderSwRegister() {
  React.useEffect(() => {
    if (!ENABLED || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/loader-sw.js", { scope: "/loader" }).catch((err) => {
      console.warn("Loader service worker registration failed", err);
    });
  }, []);
  return null;
}
