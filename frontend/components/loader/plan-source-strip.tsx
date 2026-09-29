import * as React from "react";
import { RefreshCw, WifiOff } from "lucide-react";
import { cn } from "cn";
import { formatTime, type PlanSource } from "@/lib/loader/format";
import type { SyncState } from "@/lib/loader/types";

type SyncTone = "live" | "syncing" | "offline" | "failed";

function syncTone(sync: SyncState): SyncTone {
  if (!sync.online) return "offline";
  if (sync.failed > 0) return "failed";
  if (sync.syncing || sync.pending > 0) return "syncing";
  return "live";
}

const toneStyles: Record<SyncTone, { dot: string; text: string }> = {
  live: { dot: "bg-success", text: "text-success" },
  syncing: { dot: "bg-info", text: "text-info-muted-foreground" },
  offline: { dot: "bg-warning", text: "text-warning-muted-foreground" },
  failed: { dot: "bg-destructive", text: "text-destructive" },
};

function syncLabel(tone: SyncTone, sync: SyncState): React.ReactNode {
  switch (tone) {
    case "live":
      return "Live";
    case "syncing":
      return (
        <>
          <RefreshCw className="size-3.5 motion-safe:animate-spin" aria-hidden />
          Syncing {sync.pending}
        </>
      );
    case "offline":
      return (
        <>
          <WifiOff className="size-3.5" aria-hidden />
          Offline{sync.pending > 0 && ` · ${sync.pending} pending`}
        </>
      );
    case "failed":
      return `${sync.failed} not synced`;
  }
}

interface PlanSourceStripProps {
  /** Omit version on dock-wide screens (queue). */
  plan?: PlanSource;
  sync: SyncState;
  className?: string;
}

/**
 * Strip under the app bar: where the plan came from and whether this tablet
 * is live, offline with queued actions, syncing, or failing to sync.
 */
export function PlanSourceStrip({ plan, sync, className }: PlanSourceStripProps) {
  const tone = syncTone(sync);
  const style = toneStyles[tone];

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-border bg-card px-4 py-2.5 text-xs leading-[17px] font-medium",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", style.dot)} />
      <p className="min-w-0 flex-1 truncate text-muted-foreground">
        Plan from {plan?.source ?? "Dispatcher"}
        {plan?.version !== undefined && ` · v${plan.version}`}
        {plan?.updatedAt && (
          <>
            {" · "}
            <span className="hidden sm:inline">updated </span>
            {formatTime(plan.updatedAt)}
          </>
        )}
        {plan?.acknowledgedBy && plan.acknowledgedAt && (
          <span className="hidden md:inline">
            {` · acknowledged by ${plan.acknowledgedBy} ${formatTime(plan.acknowledgedAt)}`}
          </span>
        )}
      </p>
      <p role="status" className={cn("flex shrink-0 items-center gap-1 whitespace-nowrap", style.text)}>
        {syncLabel(tone, sync)}
      </p>
    </div>
  );
}
