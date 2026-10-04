"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, WifiOff } from "lucide-react";
import { cn } from "cn";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderButton } from "@/components/loader/loader-button";
import { LoaderPill, type LoaderPillTone } from "@/components/loader/loader-pill";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useStoredSession } from "@/components/loader/loader-session";
import { useLoaderSync } from "@/components/loader/loader-sync-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { depotName, formatTime, ISSUE_TYPE_LABELS, isIssueWaiting, issueStatusLine } from "@/lib/loader/format";
import {
  cachedIssues,
  loadIssues,
  localFlags,
  type LoadedIssues,
  type LocalFlag,
} from "@/lib/loader/offline/issues-cache";
import type { IssueStatus, LoaderIssue } from "@/lib/loader/types";

const REFRESH_MS = 30_000;

const STATUS_PILL: Record<IssueStatus, { tone: LoaderPillTone; label: string }> = {
  sent: { tone: "warning", label: "Waiting" },
  seen: { tone: "warning", label: "Seen" },
  decided: { tone: "success", label: "Answered" },
  default_applied: { tone: "neutral", label: "Default applied" },
};

interface IssuesState {
  loaded?: LoadedIssues;
  local: LocalFlag[];
  ready: boolean;
}

/** The depot's issues, refetched after each sync, on return to the tab and every 30 s. */
function useIssues(depot: string | undefined): IssuesState {
  const { transport, sync } = useLoaderSync();
  const [state, setState] = React.useState<IssuesState>(() => ({
    loaded: depot ? cachedIssues(depot) : undefined,
    local: [],
    ready: false,
  }));

  const refresh = React.useCallback(async () => {
    if (!depot) return;
    const [loaded, local] = await Promise.all([loadIssues(transport, depot), localFlags()]);
    setState((s) => ({ loaded: loaded ?? s.loaded, local, ready: true }));
  }, [transport, depot]);

  React.useEffect(() => {
    const id = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(id);
  }, [refresh, sync.lastSyncedAt, sync.pending, sync.failed, sync.stale]);

  React.useEffect(() => {
    const id = window.setInterval(() => void refresh(), REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return state;
}

/**
 * Issues tab (L5; not designed in Figma): flags waiting on the Dispatcher,
 * flags this tablet has not sent yet, and answered ones. Kept simple.
 */
export function IssuesView() {
  const depot = useStoredSession()?.session.depot;
  const { loaded, local, ready } = useIssues(depot);
  const { dismissActions } = useLoaderSync();
  const issues = loaded?.issues ?? [];
  const waiting = issues.filter(isIssueWaiting);
  const answered = issues.filter((i) => !isIssueWaiting(i));

  return (
    <LoaderScreen title="Issues">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-primary">Issues</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs text-muted-foreground">Flags sent to the Dispatcher at {depot ? depotName(depot) : "this depot"}.</p>
            {loaded?.source === "cache" && (
              <InfoChip tone="warning" icon={<WifiOff />}>
                Offline · as of {formatTime(loaded.fetchedAt)}
              </InfoChip>
            )}
          </div>
        </header>

        {!loaded && !ready ? (
          <div role="status" aria-label="Loading issues" className="flex flex-col gap-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : (
          <>
            {local.length > 0 && (
              <IssueSection title="Not sent yet" count={local.length}>
                {local.map((flag) => (
                  <LocalFlagRow key={flag.clientActionId} flag={flag} onDismiss={dismissActions} />
                ))}
              </IssueSection>
            )}
            <IssueSection title="Waiting on the Dispatcher" count={waiting.length} empty="Nothing waiting.">
              {waiting.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </IssueSection>
            <IssueSection title="Answered" count={answered.length} empty="No answers yet today.">
              {answered.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </IssueSection>
            {!loaded && (
              <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                The issues list isn’t on this tablet yet. Reconnect to load it.
              </p>
            )}
          </>
        )}
      </div>
    </LoaderScreen>
  );
}

function IssueSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-primary">{title}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {count > 0 ? (
        <ul className="flex flex-col gap-2">{children}</ul>
      ) : (
        empty && <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

const rowClass = "flex min-h-12 items-center gap-3 rounded-xl border border-border bg-card p-4";

function IssueRow({ issue }: { issue: LoaderIssue }) {
  const pill = STATUS_PILL[issue.status];
  return (
    <li>
      <Link
        href={`/loader/issues/${issue.id}`}
        className={cn(rowClass, "outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50")}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-semibold text-foreground">{issue.order_number}</span>
            <LoaderPill tone="error">{ISSUE_TYPE_LABELS[issue.issue_type]}</LoaderPill>
            <LoaderPill tone={pill.tone}>{pill.label}</LoaderPill>
          </div>
          <p className="text-xs text-muted-foreground">
            {issue.units_affected} of {issue.units_total} units · {issue.run_code} · {issue.outlet_code} · flagged{" "}
            {formatTime(issue.reported_at)} by {issue.reported_by}
          </p>
          <p
            className={cn(
              "text-xs font-medium",
              isIssueWaiting(issue) ? "text-warning-muted-foreground" : "text-success",
            )}
          >
            {issueStatusLine(issue)}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  );
}

/**
 * Why a flag did not go through, for the loader. Refusals are final: the flag
 * is not sent again, and the loader clears it with OK.
 */
function refusedReason(flag: LocalFlag): string {
  if (flag.conflictCode === "INVALID_STATE_TRANSITION") {
    return "This order already has a flag, or can’t be flagged any more.";
  }
  if (flag.conflictCode === "PLAN_VERSION_STALE" || flag.conflictCode === "PLAN_NOT_ACKNOWLEDGED") {
    return "The plan changed before it was sent. Check the order on the new plan.";
  }
  if (flag.lastError?.startsWith("INVALID_FLAG")) {
    return "The flag was incomplete: no signed-in loader, or the units were out of range.";
  }
  return "The server refused this flag.";
}

function LocalFlagRow({ flag, onDismiss }: { flag: LocalFlag; onDismiss: (ids: string[]) => Promise<void> }) {
  const refused = flag.status !== "pending";
  return (
    <li className={rowClass}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-base font-semibold text-foreground">{flag.flag.order_number}</span>
          <LoaderPill tone="error">{ISSUE_TYPE_LABELS[flag.flag.issue_type]}</LoaderPill>
          <LoaderPill tone={refused ? "error" : "info"}>{refused ? "Not synced" : "Waiting to send"}</LoaderPill>
        </div>
        <p className="text-xs text-muted-foreground">
          {flag.flag.units_affected} {flag.flag.units_affected === 1 ? "unit" : "units"} · {flag.runCode} · flagged{" "}
          {formatTime(flag.createdAt)}
        </p>
        <p className="text-xs font-medium text-muted-foreground">
          {refused ? refusedReason(flag) : "Goes to the Dispatcher when the tablet reconnects."}
        </p>
      </div>
      {refused && (
        <LoaderButton variant="ghost" className="shrink-0" onClick={() => void onDismiss([flag.clientActionId])}>
          OK
        </LoaderButton>
      )}
    </li>
  );
}
