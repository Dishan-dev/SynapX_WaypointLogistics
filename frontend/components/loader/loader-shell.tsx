"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { FlagIssueHost } from "./flag-issue-sheet";
import { WaitingFlagsProvider } from "./flag-status";
import { LoaderBottomNav, type LoaderTab } from "./loader-bottom-nav";
import { listOutbox } from "@/lib/loader/offline/db";
import { loadIssues } from "@/lib/loader/offline/issues-cache";
import { warmRunPages } from "@/lib/loader/offline/run-pages";
import { LoaderSyncProvider, useLoaderSync } from "./loader-sync-provider";

export interface LoaderShellUser {
  name: string;
  /** "Saman J.", used for checked_by on local actions. */
  shortName: string;
  initials: string;
}

interface LoaderShellContextValue {
  user: LoaderShellUser;
  /** "Peliyagoda DC · Dock 3" */
  dockLabel: string;
  /** Sent as loader_session_id on every write; null until L2 sign-in. */
  sessionId: number | null;
  /** The run opened last in this session, if any: where Loading and Log go. */
  lastRunCode?: string;
}

const LoaderShellContext = React.createContext<LoaderShellContextValue | null>(null);

export function useLoaderShell(): LoaderShellContextValue {
  const ctx = React.useContext(LoaderShellContext);
  if (!ctx) throw new Error("useLoaderShell must be used inside <LoaderShell>");
  return ctx;
}

function activeTab(pathname: string): LoaderTab | undefined {
  if (pathname === "/loader") return "queue";
  if (/^\/loader\/runs\/[^/]+\/log/.test(pathname)) return "log";
  if (pathname.startsWith("/loader/runs/")) return "loading";
  if (pathname.startsWith("/loader/issues")) return "issues";
  if (pathname.startsWith("/loader/log")) return "log";
  if (pathname.startsWith("/loader/more")) return "more";
  return undefined;
}

/** The run code on a checklist page (/loader/runs/RUN-021), not on its sub-pages. */
function checklistCodeFrom(pathname: string): string | undefined {
  return /^\/loader\/runs\/([^/]+)\/?$/.exec(pathname)?.[1];
}

function runCodeFrom(pathname: string): string | undefined {
  return /^\/loader\/runs\/([^/]+)/.exec(pathname)?.[1];
}

/** Flags still waiting in the outbox; the server's count does not include them yet. */
async function pendingFlagCount(): Promise<number> {
  try {
    const outbox = await listOutbox();
    return outbox.filter((a) => a.action_type === "flag" && a.status === "pending").length;
  } catch {
    // IndexedDB unavailable (private mode): nothing queued to count.
    return 0;
  }
}

/**
 * Bottom nav with the Issues badge: the dock's open issues from the server,
 * plus flags queued on this tablet, so the badge rises as soon as a flag is
 * queued offline. When queued flags go out, the list is reloaded so the
 * server's count takes them over.
 */
function ShellBottomNav({
  active,
  loadingHref,
  logHref,
  dock,
  issueCount,
}: {
  active?: LoaderTab;
  loadingHref: string;
  logHref: string;
  dock?: string;
  issueCount?: number;
}) {
  const { sync, transport } = useLoaderSync();
  const [pendingFlags, setPendingFlags] = React.useState(0);
  const lastPending = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    void pendingFlagCount().then((count) => {
      if (cancelled) return;
      const sent = count < lastPending.current;
      lastPending.current = count;
      setPendingFlags(count);
      if (sent && sync.online && dock) void loadIssues(transport, dock).catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [sync.pending, sync.lastSyncedAt, sync.online, dock, transport]);

  const total = (issueCount ?? 0) + pendingFlags;
  return (
    <LoaderBottomNav
      className="sticky bottom-0 z-30"
      active={active}
      loadingHref={loadingHref}
      logHref={logHref}
      issueCount={total}
    />
  );
}

/**
 * While a run's checklist is open online, fetch its Review, Ready and Log
 * pages once so they open offline later (the service worker keeps them until
 * sign-out).
 */
function RunPageWarmer({ checklistCode }: { checklistCode?: string }) {
  const { sync } = useLoaderSync();
  const warmed = React.useRef(new Set<string>());

  React.useEffect(() => {
    if (!checklistCode || !sync.online || warmed.current.has(checklistCode)) return;
    warmed.current.add(checklistCode);
    void warmRunPages(checklistCode);
  }, [checklistCode, sync.online]);

  return null;
}

interface LoaderShellProps {
  user: LoaderShellUser;
  dockLabel: string;
  /** The session's dock ("Dock 3"), to reload its issues after queued flags go out. */
  dock?: string;
  sessionId: number | null;
  issueCount?: number;
  children: React.ReactNode;
}

/** Frame for signed-in loader screens: page content plus the bottom nav. */
export function LoaderShell({ user, dockLabel, dock, sessionId, issueCount, children }: LoaderShellProps) {
  const pathname = usePathname();

  // Loading tab returns to the run opened last in this session.
  const [lastRunCode, setLastRunCode] = React.useState<string>();
  const currentRunCode = runCodeFrom(pathname);
  if (currentRunCode && currentRunCode !== lastRunCode) setLastRunCode(currentRunCode);

  const ctx = React.useMemo<LoaderShellContextValue>(
    () => ({ user, dockLabel, sessionId, lastRunCode }),
    [user, dockLabel, sessionId, lastRunCode],
  );

  return (
    <LoaderShellContext.Provider value={ctx}>
      <LoaderSyncProvider sessionId={sessionId}>
        <div className="flex min-h-dvh flex-col bg-background">
          <WaitingFlagsProvider dock={dock} onRunPage={pathname.startsWith("/loader/runs/")}>
            <div className="flex flex-1 flex-col">{children}</div>
          </WaitingFlagsProvider>
          <ShellBottomNav
            active={activeTab(pathname)}
            loadingHref={lastRunCode ? `/loader/runs/${lastRunCode}` : "/loader"}
            logHref={lastRunCode ? `/loader/runs/${lastRunCode}/log` : "/loader/log"}
            dock={dock}
            issueCount={issueCount}
          />
        </div>
        <FlagIssueHost />
        <RunPageWarmer checklistCode={checklistCodeFrom(pathname)} />
      </LoaderSyncProvider>
    </LoaderShellContext.Provider>
  );
}
