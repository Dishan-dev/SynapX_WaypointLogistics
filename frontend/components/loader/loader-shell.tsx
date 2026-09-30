"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { LoaderBottomNav, type LoaderTab } from "./loader-bottom-nav";
import { LoaderSyncProvider } from "./loader-sync-provider";

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

function runCodeFrom(pathname: string): string | undefined {
  return /^\/loader\/runs\/([^/]+)/.exec(pathname)?.[1];
}

interface LoaderShellProps {
  user: LoaderShellUser;
  dockLabel: string;
  sessionId: number | null;
  issueCount?: number;
  children: React.ReactNode;
}

/** Frame for signed-in loader screens: page content plus the bottom nav. */
export function LoaderShell({ user, dockLabel, sessionId, issueCount, children }: LoaderShellProps) {
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
          <div className="flex flex-1 flex-col">{children}</div>
          <LoaderBottomNav
            className="sticky bottom-0 z-30"
            active={activeTab(pathname)}
            loadingHref={lastRunCode ? `/loader/runs/${lastRunCode}` : "/loader"}
            logHref={lastRunCode ? `/loader/runs/${lastRunCode}/log` : "/loader/log"}
            issueCount={issueCount}
          />
        </div>
      </LoaderSyncProvider>
    </LoaderShellContext.Provider>
  );
}
