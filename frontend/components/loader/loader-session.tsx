"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { RoleGuard } from "@/components/auth/role-guard";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { depotLabel, userLabel } from "@/lib/loader/format";
import type { CachedQueue } from "@/lib/loader/offline/db";
import { ISSUES_EVENT } from "@/lib/loader/offline/issues-cache";
import { cachedQueue, QUEUE_EVENT } from "@/lib/loader/offline/queue-cache";
import { createTransport, MOCK_TRANSPORT, NetworkError, SignInRefusedError } from "@/lib/loader/offline/transport";
import {
  endReason,
  endSession,
  IDLE_SIGN_OUT_MS,
  IDLE_WARNING_MS,
  readSession,
  saveSession,
  subscribeSession,
  type StoredSession,
} from "@/lib/loader/session";
import type { SessionEndReason } from "@/lib/loader/types";
import { LoaderButton } from "./loader-button";
import { LoaderGateScreen } from "./loader-gate-screen";
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
 * Loader screens need the shared Waypoint (Keycloak) sign-in with the loader
 * role, like the dispatcher's. With NEXT_PUBLIC_LOADER_TRANSPORT=mock there is
 * no server and no Keycloak, so the sample loader is let in.
 */
export function LoaderAuthGate({ children }: { children: React.ReactNode }) {
  if (MOCK_TRANSPORT) return <>{children}</>;
  return (
    <RoleGuard allowedRoles={["loader"]} fallbackTitle="Loader Access Required">
      {children}
    </RoleGuard>
  );
}

/**
 * Loader screens need a tablet session. Without one it is opened at once for
 * the signed-in account (POST /loader/session, no PIN). After a sign-out here
 * it goes to /loader/sign-in instead, which says why; signed out in another
 * tab, it opens a new one.
 */
export function SessionGate({ children }: { children: React.ReactNode }) {
  const stored = useStoredSession();
  const hydrated = useHydrated();
  const issueCount = useIssueCount(stored?.session.depot);
  const router = useRouter();
  const pathname = usePathname();
  const reason = hydrated && !stored ? endReason() : undefined;

  React.useEffect(() => {
    if (reason) router.replace(`/loader/sign-in?reason=${reason}&next=${encodeURIComponent(pathname)}`);
  }, [reason, router, pathname]);

  const user = React.useMemo(() => (stored ? userLabel(stored.user) : undefined), [stored]);

  if (!stored || !user) {
    if (hydrated && !reason) return <OpenSession />;
    return <div aria-busy className="min-h-dvh bg-background" />;
  }
  return (
    <LoaderShell
      user={user}
      depotLabel={depotLabel(stored.session)}
      depot={stored.session.depot}
      sessionId={stored.session.session_id}
      issueCount={issueCount}
    >
      {children}
      <IdleSignOut />
    </LoaderShell>
  );
}

type Opening = { status: "opening" } | { status: "refused"; message: string } | { status: "offline" };

/**
 * Opens this account's loader session and saves it, which lets SessionGate
 * show the loader. A missing or expired token goes back to the Waypoint
 * sign-in; a refusal (no depot yet, not a loader, two loaders with the name)
 * says why.
 */
function OpenSession() {
  const { user: account, loginWithKeycloak, logout } = useAuth();
  const transport = React.useMemo(() => createTransport(), []);
  const [state, setState] = React.useState<Opening>({ status: "opening" });
  const [attempt, setAttempt] = React.useState(0);
  const name = account?.name;

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const session = await transport.startSession({});
        if (cancelled) return;
        if (!session) {
          void loginWithKeycloak("loader", window.location.pathname + window.location.search);
          return;
        }
        const { id, short_name } = session.loader;
        saveSession({ session, user: { id, short_name, full_name: name || short_name } });
      } catch (err) {
        if (cancelled) return;
        if (err instanceof SignInRefusedError) setState({ status: "refused", message: err.message });
        else if (err instanceof NetworkError) setState({ status: "offline" });
        else throw err;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transport, attempt, name, loginWithKeycloak]);

  const retry = () => {
    setState({ status: "opening" });
    setAttempt((n) => n + 1);
  };
  const signOut = MOCK_TRANSPORT ? null : (
    <LoaderButton variant="secondary" onClick={() => void logout(true)}>
      Sign out
    </LoaderButton>
  );

  if (state.status === "refused") {
    return (
      <LoaderGateScreen title="Can't open the loader" message={state.message}>
        <LoaderButton onClick={retry}>Try again</LoaderButton>
        {signOut}
      </LoaderGateScreen>
    );
  }
  if (state.status === "offline") {
    return (
      <LoaderGateScreen title="Can't reach the server" message="Check the tablet's connection, then try again.">
        <LoaderButton onClick={retry}>Try again</LoaderButton>
      </LoaderGateScreen>
    );
  }
  return <LoaderGateScreen title="Signing in…" message={name ? `Opening the loader for ${name}.` : undefined} />;
}

/**
 * Open issues at the depot for the Issues tab badge: the last summary this
 * tablet loaded, updated whenever the queue or the Issues list loads again.
 */
function useIssueCount(depot: string | undefined): number | undefined {
  const [count, setCount] = React.useState<number>();
  React.useEffect(() => {
    if (!depot) return;
    let cancelled = false;
    void cachedQueue(depot).then((cached) => {
      if (!cancelled && cached) setCount(cached.summary.issues.count);
    });
    const onQueue = (e: Event) => {
      const loaded = (e as CustomEvent<CachedQueue>).detail;
      if (loaded.depot === depot) setCount(loaded.summary.issues.count);
    };
    const onIssues = (e: Event) => {
      const loaded = (e as CustomEvent<{ depot: string; waiting: number }>).detail;
      if (loaded.depot === depot) setCount(loaded.waiting);
    };
    window.addEventListener(QUEUE_EVENT, onQueue);
    window.addEventListener(ISSUES_EVENT, onIssues);
    return () => {
      cancelled = true;
      window.removeEventListener(QUEUE_EVENT, onQueue);
      window.removeEventListener(ISSUES_EVENT, onIssues);
    };
  }, [depot]);
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
