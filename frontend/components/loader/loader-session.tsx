"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dockLabel, userLabel } from "@/lib/loader/format";
import type { CachedQueue } from "@/lib/loader/offline/db";
import { ISSUES_EVENT } from "@/lib/loader/offline/issues-cache";
import { cachedQueue, QUEUE_EVENT } from "@/lib/loader/offline/queue-cache";
import {
  endReason,
  endSession,
  IDLE_SIGN_OUT_MS,
  IDLE_WARNING_MS,
  readSession,
  subscribeSession,
  type StoredSession,
} from "@/lib/loader/session";
import type { SessionEndReason } from "@/lib/loader/types";
import { LoaderButton } from "./loader-button";
import { LoaderShell } from "./loader-shell";
import { useLoaderSync } from "./loader-sync-provider";

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
 * Loader screens need a signed-in loader. Without a session this goes to
 * sign-in: after a sign-out here it says why; otherwise (never signed in, or
 * signed out in another tab) it comes back to the same page afterwards.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const stored = useStoredSession();
  const hydrated = useHydrated();
  const issueCount = useIssueCount(stored?.session.dock);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!hydrated || stored) return;
    const reason = endReason();
    router.replace(reason ? `/loader/sign-in?reason=${reason}` : `/loader/sign-in?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, stored, router, pathname]);

  const user = React.useMemo(() => (stored ? userLabel(stored.user) : undefined), [stored]);

  if (!stored || !user) {
    return <div aria-busy className="min-h-dvh bg-background" />;
  }
  return (
    <LoaderShell
      user={user}
      dockLabel={dockLabel(stored.session)}
      dock={stored.session.dock}
      sessionId={stored.session.session_id}
      issueCount={issueCount}
    >
      {children}
      <IdleSignOut />
    </LoaderShell>
  );
}

/**
 * Open issues at the dock for the Issues tab badge: the last summary this
 * tablet loaded, updated whenever the queue or the Issues list loads again.
 */
function useIssueCount(dock: string | undefined): number | undefined {
  const [count, setCount] = React.useState<number>();
  React.useEffect(() => {
    if (!dock) return;
    let cancelled = false;
    void cachedQueue(dock).then((cached) => {
      if (!cancelled && cached) setCount(cached.summary.issues.count);
    });
    const onQueue = (e: Event) => {
      const loaded = (e as CustomEvent<CachedQueue>).detail;
      if (loaded.dock === dock) setCount(loaded.summary.issues.count);
    };
    const onIssues = (e: Event) => {
      const loaded = (e as CustomEvent<{ dock: string; waiting: number }>).detail;
      if (loaded.dock === dock) setCount(loaded.waiting);
    };
    window.addEventListener(QUEUE_EVENT, onQueue);
    window.addEventListener(ISSUES_EVENT, onIssues);
    return () => {
      cancelled = true;
      window.removeEventListener(QUEUE_EVENT, onQueue);
      window.removeEventListener(ISSUES_EVENT, onIssues);
    };
  }, [dock]);
  return count;
}

/**
 * Ends this tablet's session (DELETE /loader/session/{id}, or later if
 * offline). SessionGate then goes to sign-in and says why.
 */
export function useSignOut(): (reason: SessionEndReason) => Promise<void> {
  const { transport } = useLoaderSync();
  return React.useCallback((reason: SessionEndReason) => endSession(transport, reason), [transport]);
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel"] as const;

/**
 * Signs out after IDLE_SIGN_OUT_MS without a touch or key, with a "Still
 * there?" warning for the last IDLE_WARNING_MS. Wall-clock based, so time
 * with the screen off or the tab hidden counts too.
 */
function IdleSignOut() {
  const signOut = useSignOut();
  const lastActive = React.useRef(0);
  // seconds stays set while the dialog animates closed.
  const [warning, setWarning] = React.useState({ open: false, seconds: 0 });

  React.useEffect(() => {
    lastActive.current = Date.now();
    let ended = false;
    const tick = () => {
      if (ended) return;
      const left = IDLE_SIGN_OUT_MS - (Date.now() - lastActive.current);
      if (left <= 0) {
        ended = true;
        void signOut("idle_timeout");
        return;
      }
      if (left <= IDLE_WARNING_MS) setWarning({ open: true, seconds: Math.ceil(left / 1000) });
      else setWarning((w) => (w.open ? { ...w, open: false } : w));
    };
    const onActivity = () => {
      lastActive.current = Date.now();
      setWarning((w) => (w.open ? { ...w, open: false } : w));
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    const id = window.setInterval(tick, 1000);
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [signOut]);

  // Any touch keeps the session: the dialog closes on the same pointerdown.
  return (
    <Dialog open={warning.open}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription role="timer" aria-live="polite">
            Signing out in {warning.seconds} s so the next loader can sign in.
          </DialogDescription>
        </DialogHeader>
        <LoaderButton className="w-full">I’m still here</LoaderButton>
      </DialogContent>
    </Dialog>
  );
}
