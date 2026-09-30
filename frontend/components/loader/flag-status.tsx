"use client";

import * as React from "react";
import { isIssueWaiting } from "@/lib/loader/format";
import { cachedIssues, ISSUES_EVENT, loadIssues, localFlags } from "@/lib/loader/offline/issues-cache";
import { useLoaderSync } from "./loader-sync-provider";

// Which flagged orders are still waiting on the Dispatcher, so an order row can
// say so ("6 Order row states", Figma 243:14109). The run read does not carry
// the flag's status, so it comes from the issues data: the dock's issues as
// last loaded, plus flags still queued on this tablet. An answered flag, or
// one this tablet knows nothing about, is not listed.

const WaitingFlagsContext = React.createContext<ReadonlySet<string>>(new Set());

/** True while the order's flag is sent or seen and not yet answered. */
export function useFlagWaiting(orderNumber: string): boolean {
  return React.useContext(WaitingFlagsContext).has(orderNumber);
}

/** Orders with a waiting flag in the dock's last loaded issues list. */
function serverWaiting(dock: string | undefined): string[] {
  const issues = (dock && cachedIssues(dock)?.issues) || [];
  return issues.filter(isIssueWaiting).map((i) => i.order_number);
}

/**
 * Keeps the waiting set current: from the cached list at once, the queued
 * flags whenever the outbox changes, and a fresh GET /loader/issues on run
 * pages after each sync (so a Dispatcher answer clears the text).
 */
export function WaitingFlagsProvider({
  dock,
  onRunPage,
  children,
}: {
  dock?: string;
  /** Only run pages show order rows; elsewhere the list is not fetched for this. */
  onRunPage: boolean;
  children: React.ReactNode;
}) {
  const { sync, transport } = useLoaderSync();
  const [queued, setQueued] = React.useState<string[]>([]);
  // The provider mounts per session, so the dock does not change under it.
  const [fromServer, setFromServer] = React.useState(() => serverWaiting(dock));

  // Flags still in the outbox count as waiting until the server has them.
  React.useEffect(() => {
    let cancelled = false;
    void localFlags()
      .then((flags) => {
        if (cancelled) return;
        setQueued(flags.filter((f) => f.status === "pending").map((f) => f.flag.order_number));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sync.pending, sync.lastSyncedAt]);

  // Any fresh issues list (this provider's, the Issues tab's, the badge's) is re-read from the cache.
  React.useEffect(() => {
    const onIssues = () => setFromServer(serverWaiting(dock));
    window.addEventListener(ISSUES_EVENT, onIssues);
    return () => window.removeEventListener(ISSUES_EVENT, onIssues);
  }, [dock]);

  React.useEffect(() => {
    if (!dock || !onRunPage || !sync.online) return;
    void loadIssues(transport, dock).catch(() => {});
  }, [dock, onRunPage, sync.online, sync.lastSyncedAt, transport]);

  const waiting = React.useMemo(() => new Set([...fromServer, ...queued]), [fromServer, queued]);

  return <WaitingFlagsContext.Provider value={waiting}>{children}</WaitingFlagsContext.Provider>;
}
