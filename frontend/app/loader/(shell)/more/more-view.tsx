"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useLoaderShell } from "@/components/loader/loader-shell";

const rowClass =
  "flex min-h-12 items-center gap-3 px-4 text-base font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

/**
 * More tab (not designed yet): who is signed in, Switch user and Sign out.
 * Ending the session (DELETE /loader/session/{id}) arrives with L2; both
 * actions go to sign-in for now.
 */
export function MoreView() {
  const { user, dockLabel } = useLoaderShell();

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
            <p className="truncate text-xs text-muted-foreground">Loader · {dockLabel}</p>
          </div>
        </div>

        <nav aria-label="Account" className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <Link href="/loader/sign-in?reason=switch_user" className={rowClass}>
            <UserRound className="size-5 text-muted-foreground" aria-hidden />
            Switch user
          </Link>
          <Link href="/loader/sign-in?reason=sign_out" className={rowClass}>
            <LogOut className="size-5 text-muted-foreground" aria-hidden />
            Sign out
          </Link>
        </nav>
      </div>
    </LoaderScreen>
  );
}
