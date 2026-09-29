"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { dockLabel, userLabel } from "@/lib/loader/format";
import { readSession, subscribeSession, type StoredSession } from "@/lib/loader/session";
import { LoaderShell } from "./loader-shell";

const noSubscribe = () => () => {};

/** This tablet's session; null on the server and until the browser has read it. */
export function useStoredSession(): StoredSession | null {
  return React.useSyncExternalStore(subscribeSession, readSession, () => null);
}

/** False while hydrating, when the stored session cannot be read yet. */
function useHydrated(): boolean {
  return React.useSyncExternalStore(noSubscribe, () => true, () => false);
}

/**
 * Loader screens need a signed-in loader. Without a session (never signed in,
 * signed out, or signed out in another tab) this goes to sign-in and comes
 * back to the same page afterwards.
 */
export function SessionGate({ issueCount, children }: { issueCount?: number; children: React.ReactNode }) {
  const stored = useStoredSession();
  const hydrated = useHydrated();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (hydrated && !stored) router.replace(`/loader/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, stored, router, pathname]);

  const user = React.useMemo(() => (stored ? userLabel(stored.user) : undefined), [stored]);

  if (!stored || !user) {
    return <div aria-busy className="min-h-dvh bg-background" />;
  }
  return (
    <LoaderShell
      user={user}
      dockLabel={dockLabel(stored.session)}
      sessionId={stored.session.session_id}
      issueCount={issueCount}
    >
      {children}
    </LoaderShell>
  );
}
