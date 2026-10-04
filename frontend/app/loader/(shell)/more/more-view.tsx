"use client";

import * as React from "react";
import { LogOut, UserRound } from "lucide-react";
import { LoaderButton } from "@/components/loader/loader-button";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useSignOut } from "@/components/loader/loader-session";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { useLoaderSync } from "@/components/loader/loader-sync-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SessionEndReason } from "@/lib/loader/types";

const rowClass =
  "flex min-h-12 w-full items-center gap-3 px-4 text-left text-base font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

const ACTION_LABEL: Record<Exclude<SessionEndReason, "idle_timeout">, string> = {
  switch_user: "Switch user",
  sign_out: "Sign out",
};

/**
 * More tab (not designed yet): who is signed in, Switch user and Sign out.
 * Both end the session (DELETE /loader/session/{id}). Queued actions stay on
 * the tablet and are sent later under this loader's session.
 */
export function MoreView() {
  const { user, depotLabel } = useLoaderShell();
  const { sync } = useLoaderSync();
  const signOut = useSignOut();
  const [confirm, setConfirm] = React.useState<keyof typeof ACTION_LABEL>();

  const start = (reason: keyof typeof ACTION_LABEL) => {
    if (sync.pending > 0) setConfirm(reason);
    else void signOut(reason);
  };

  return (
    <LoaderScreen title="More">
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {user.initials}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">Loader · {depotLabel}</p>
          </div>
        </div>

        <nav aria-label="Account" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <button type="button" className={rowClass} onClick={() => start("switch_user")}>
            <UserRound className="size-5 text-muted-foreground" aria-hidden />
            Switch user
          </button>
          <button type="button" className={rowClass} onClick={() => start("sign_out")}>
            <LogOut className="size-5 text-muted-foreground" aria-hidden />
            Sign out
          </button>
        </nav>
      </div>

      <Dialog open={confirm !== undefined} onOpenChange={(open) => !open && setConfirm(undefined)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {sync.pending === 1 ? "1 action" : `${sync.pending} actions`} still syncing
            </DialogTitle>
            <DialogDescription>
              {sync.pending === 1 ? "It stays" : "They stay"} on this tablet and {sync.pending === 1 ? "is" : "are"} saved
              as {user.shortName} once it reconnects.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <LoaderButton variant="secondary" onClick={() => setConfirm(undefined)}>
              Stay signed in
            </LoaderButton>
            <LoaderButton onClick={() => confirm && void signOut(confirm)}>
              {confirm ? ACTION_LABEL[confirm] : "Sign out"}
            </LoaderButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LoaderScreen>
  );
}
