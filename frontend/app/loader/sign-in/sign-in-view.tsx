"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoaderButton } from "@/components/loader/loader-button";
import { LoaderGateScreen } from "@/components/loader/loader-gate-screen";
import { useAuth } from "@/lib/auth-context";
import { createTransport, MOCK_TRANSPORT } from "@/lib/loader/offline/transport";
import { endSession, IDLE_SIGN_OUT_MS, readSession } from "@/lib/loader/session";
import type { SessionEndReason } from "@/lib/loader/types";

const IDLE_MINUTES = IDLE_SIGN_OUT_MS / 60_000;

// Not in Figma: a line saying why the tablet is here.
const REASON_NOTE: Record<SessionEndReason, string> = {
  idle_timeout: `Signed out after ${IDLE_MINUTES} min idle.`,
  switch_user: "Signed out. The next loader signs in with their own Waypoint account.",
  sign_out: "Signed out.",
};

/** Where to go after sign-in: a loader page, never back here. */
function safeNext(next: string | null): string {
  const isLoader = next === "/loader" || next?.startsWith("/loader/");
  return next && isLoader && !next.startsWith("/loader/sign-in") ? next : "/loader";
}

/**
 * Where the tablet lands after its loader session ends. Loaders sign in with
 * their Waypoint (Keycloak) account, so there is no PIN pad any more:
 * - Switch user and Sign out end the tablet session (if it is still open)
 *   and the Waypoint sign-in too, so the next person signs in as themselves.
 * - After an idle sign-out the same account can carry on with one tap.
 * With no reason there is nothing to say: straight back into the loader,
 * which opens a session for the signed-in account.
 */
export function SignInView() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get("reason") as SessionEndReason | null;
  const next = safeNext(params.get("next"));
  const { user: account, logout } = useAuth();
  const transport = React.useMemo(() => createTransport(), []);
  const leaving = reason === "switch_user" || reason === "sign_out";

  React.useEffect(() => {
    if (!reason) router.replace(next);
  }, [reason, next, router]);

  React.useEffect(() => {
    if (!leaving) return;
    void (async () => {
      // Sent later when offline: endSession keeps it for flushSessionEnds.
      if (readSession()) await endSession(transport, reason).catch(() => {});
      if (!MOCK_TRANSPORT) await logout(true);
    })();
  }, [leaving, reason, transport, logout]);

  if (!reason) return <div aria-busy className="min-h-dvh bg-background" />;
  if (leaving && !MOCK_TRANSPORT) return <LoaderGateScreen title="Signing out…" note={REASON_NOTE[reason]} />;
  return (
    <LoaderGateScreen title="Signed out" note={REASON_NOTE[reason]}>
      <LoaderButton onClick={() => router.replace(next)}>
        {account?.name ? `Continue as ${account.name}` : "Sign in"}
      </LoaderButton>
      {!MOCK_TRANSPORT && (
        <LoaderButton variant="secondary" onClick={() => void logout(true)}>
          Not you? Sign out
        </LoaderButton>
      )}
    </LoaderGateScreen>
  );
}
