"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Snowflake, Truck, WifiOff } from "lucide-react";
import { cn } from "cn";
import { CapacityCard } from "@/components/loader/capacity-card";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderButton } from "@/components/loader/loader-button";
import { LoaderCard } from "@/components/loader/loader-card";
import { LoaderPill, type LoaderPillTone } from "@/components/loader/loader-pill";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { useLoaderSync, useOfflineRun } from "@/components/loader/loader-sync-provider";
import { MetricTile } from "@/components/loader/metric-tile";
import {
  formatClock,
  formatM3,
  formatTime,
  isActiveOrder,
  ISSUE_TYPE_LABELS,
  isIssueWaiting,
  partialLoads,
  planSource,
  releaseLockLabel,
  runCapacity,
  stopsInUnloadOrder,
} from "@/lib/loader/format";
import type { LoaderIssue, Run, RunStatus, RunStop } from "@/lib/loader/types";
import { RunGate, useRunIssues } from "./run-gate";

const STATUS_PILL: Record<RunStatus, { tone: LoaderPillTone; label: string }> = {
  not_started: { tone: "neutral", label: "Not started" },
  loading: { tone: "warning", label: "Loading" },
  issue_flagged: { tone: "error", label: "Issue flagged" },
  loaded: { tone: "primary", label: "Loaded" },
  ready_to_depart: { tone: "success", label: "Ready to depart" },
  gated_out: { tone: "neutral", label: "Gated out" },
};

export const readyHref = (code: string) => `/loader/runs/${encodeURIComponent(code)}/ready`;

export function ReviewView({ code }: { code: string }) {
  return (
    <RunGate code={code} title="Confirm & release">
      {(run) => <Review initial={run} />}
    </RunGate>
  );
}

/**
 * Confirm & release (Figma 1e, 11, 17 · T1e): the final load, the flags and
 * their answers, the driver's unload order and who releases. Release is
 * locked while release_blockers lists anything, and offline.
 */
function Review({ initial }: { initial: Run }) {
  const router = useRouter();
  const { user, dockLabel } = useLoaderShell();
  const { sync } = useLoaderSync();
  const { run, act, rejected, dismissRejected } = useOfflineRun(initial, user.shortName);
  const issues = useRunIssues(run.code);
  const [releasing, setReleasing] = React.useState(false);
  const [openedAt] = React.useState(() => new Date().toISOString());

  const dockName = dockLabel.split(" · ").pop() ?? dockLabel;
  const status = STATUS_PILL[run.status];
  const capacity = runCapacity(run);
  const spare = Math.max(0, run.capacity.max_volume_m3 - run.capacity.loaded_volume_m3);
  const partial = partialLoads(issues);
  // A partial order is on the truck: count it as loaded even if its row is still flagged.
  const rows = run.stops.flatMap((s) => s.orders);
  const flaggedPartials = partial.orderNumbers.filter(
    (n) => rows.find((o) => o.order_number === n)?.state === "flagged",
  ).length;
  const waiting = issues.filter(isIssueWaiting);
  const lastAnswer = issues
    .filter((i) => !isIssueWaiting(i) && i.decided_at)
    .sort((a, b) => (b.decided_at ?? "").localeCompare(a.decided_at ?? ""))[0];
  const lockLabel = releaseLockLabel(run);
  const refusedRelease = rejected.filter((a) => a.action_type === "release" && a.conflict_code === "RELEASE_LOCKED");
  const ready = run.status === "ready_to_depart";

  const release = async () => {
    setReleasing(true);
    const action = await act("release");
    if (action) router.push(readyHref(run.code));
    else setReleasing(false);
  };

  const footer = (
    <div className="flex flex-col gap-2 md:flex-row-reverse md:items-center md:justify-between md:gap-4">
      {ready ? (
        <LoaderButton className="w-full md:w-auto" onClick={() => router.push(readyHref(run.code))}>
          View ready to depart
        </LoaderButton>
      ) : !sync.online ? (
        <LoaderButton className="w-full md:w-auto" locked>
          Release needs a connection
        </LoaderButton>
      ) : lockLabel ? (
        <LoaderButton className="h-auto min-h-12 w-full py-2.5 whitespace-normal md:w-auto" locked>
          Release locked · {lockLabel}
        </LoaderButton>
      ) : (
        <LoaderButton className="w-full md:w-auto" disabled={releasing} onClick={() => void release()}>
          Mark ready to depart
        </LoaderButton>
      )}
      <p className="text-xs leading-[17px] text-muted-foreground">
        {ready
          ? `Signed off${run.released_by ? ` by ${run.released_by}` : ""}.`
          : !sync.online
            ? "Releasing needs a connection, so the Dispatcher and the driver get it. Your checks are saved on this tablet."
            : lockLabel
              ? "Finish what is listed first. The truck can’t leave on an open plan or a waiting flag."
              : `Status ${status.label} → Ready to depart. Undo for 10 s.`}
      </p>
    </div>
  );

  return (
    <LoaderScreen
      title="Confirm & release"
      subtitle={`${run.code} · ${dockName} · ${user.shortName}`}
      plan={planSource(run)}
      footer={footer}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <header className="flex flex-col gap-1.5">
          <nav aria-label="Breadcrumb" className="text-xs leading-[17px] font-medium text-muted-foreground">
            <Link href="/loader" className="hover:underline">
              Queue
            </Link>
            {" / "}
            <Link href={`/loader/runs/${encodeURIComponent(run.code)}`} className="hover:underline">
              {run.code}
            </Link>
            {" / Confirm"}
          </nav>
          <h1 className="text-xl leading-[26px] font-semibold text-primary">Ready to depart?</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <LoaderPill tone={status.tone}>{status.label}</LoaderPill>
            <InfoChip icon={<Truck />}>{run.vehicle.code}</InfoChip>
            {run.vehicle.temp_capability === "reefer" && (
              <InfoChip tone="info" icon={<Snowflake />}>
                Reefer
              </InfoChip>
            )}
          </div>
          <p className="text-xs leading-[17px] text-muted-foreground">Check once. This becomes the driver’s run sheet.</p>
        </header>

        {refusedRelease.length > 0 && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive-muted px-4 py-3">
            <p className="text-sm font-semibold text-destructive">The server refused the release.</p>
            <p className="text-sm text-foreground">
              {lockLabel ? `Still open: ${lockLabel}.` : "Check the run again, then release."}
            </p>
            <LoaderButton variant="ghost" className="w-fit" onClick={() => void dismissRejected()}>
              OK
            </LoaderButton>
          </div>
        )}
        {!sync.online && (
          <p role="status" className="flex items-center gap-2 text-sm text-warning-muted-foreground">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            Offline. Release waits for the connection.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Orders" value={run.orders_total} caption={`Plan v${run.current_plan_version}`} />
          <MetricTile
            label="Loaded"
            value={run.orders_loaded + flaggedPartials}
            caption={
              partial.orders
                ? `${partial.orders} partial ${partial.orders === 1 ? "order" : "orders"}`
                : run.orders_loaded + flaggedPartials === run.orders_total
                  ? "All on the truck"
                  : `${run.orders_total - run.orders_loaded - flaggedPartials} to go`
            }
          />
          <MetricTile
            label="Issues"
            value={issues.length}
            caption={
              waiting.length
                ? `${waiting.length} waiting`
                : lastAnswer?.decided_at
                  ? `Answered ${formatTime(lastAnswer.decided_at)}`
                  : "None flagged"
            }
          />
          <MetricTile label="Spare" value={formatM3(spare)} caption={`of ${formatM3(run.capacity.max_volume_m3)}`} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <CapacityCard {...capacity} />
              {partial.unitsLeft > 0 && (
                <p className="px-1 text-xs text-muted-foreground">
                  {partial.unitsLeft} {partial.unitsLeft === 1 ? "unit stays" : "units stay"} at the dock on answered flags.
                </p>
              )}
            </div>
            <IssuesCard issues={issues} />
          </div>
          <div className="flex flex-col gap-4">
            <UnloadOrderCard run={run} />
            <LoaderCard title="Handover">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                >
                  {user.initials}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium break-words text-foreground">Releasing as {user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTime(openedAt)} · {dockName}
                  </span>
                </div>
                <Link
                  href="/loader/sign-in?reason=switch_user"
                  className="flex min-h-12 items-center rounded-md px-2 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Switch
                </Link>
              </div>
            </LoaderCard>
          </div>
        </div>
      </div>
    </LoaderScreen>
  );
}

function IssuesCard({ issues }: { issues: LoaderIssue[] }) {
  const anyWaiting = issues.some(isIssueWaiting);
  return (
    <LoaderCard
      title={
        <span className="flex items-center justify-between gap-2">
          Issues sent to Dispatcher
          {issues.length > 0 && (
            <LoaderPill tone={anyWaiting ? "warning" : "success"}>{anyWaiting ? "Waiting" : "Answered"}</LoaderPill>
          )}
        </span>
      }
    >
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">No flags on this run.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {issues.map((issue) => (
            <li key={issue.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">
                  {issue.order_number} · {issue.outlet_code}
                </span>
                <LoaderPill tone="error">{ISSUE_TYPE_LABELS[issue.issue_type]}</LoaderPill>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt className="text-muted-foreground">Units</dt>
                <dd className="text-right text-foreground">
                  {issue.units_affected} of {issue.units_total} ·{" "}
                  {issue.issue_type === "missing"
                    ? "not on the truck"
                    : `${issue.units_total - issue.units_affected} go on the truck`}
                </dd>
                {(issue.quick_note_tag || issue.note) && (
                  <>
                    <dt className="text-muted-foreground">Note</dt>
                    <dd className="text-right text-foreground">
                      {[issue.quick_note_tag, issue.note].filter(Boolean).join(" · ")}
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Flagged by</dt>
                <dd className="text-right text-foreground">
                  {issue.reported_by} · {formatTime(issue.reported_at)}
                </dd>
              </dl>
              <IssueAnswer issue={issue} />
            </li>
          ))}
        </ul>
      )}
    </LoaderCard>
  );
}

function IssueAnswer({ issue }: { issue: LoaderIssue }) {
  const chosen = issue.options.find((o) => o.is_chosen);
  if (isIssueWaiting(issue)) {
    return (
      <p className="rounded-md bg-warning-muted px-3 py-2 text-sm font-medium text-warning-muted-foreground">
        Waiting on the Dispatcher · decide by {formatTime(issue.decide_by)}
      </p>
    );
  }
  const who = issue.status === "default_applied" ? "Default applied" : "Dispatcher";
  return (
    <p className="rounded-md bg-background px-3 py-2 text-sm font-semibold text-foreground">
      {who} {formatTime(issue.decided_at ?? issue.decide_by)}: {chosen?.label ?? "answered"}
      {chosen?.detail && <span className="font-normal text-muted-foreground"> · {chosen.detail}</span>}
    </p>
  );
}

function UnloadOrderCard({ run }: { run: Run }) {
  const stops = stopsInUnloadOrder(run.stops).filter((s) => s.orders.some(isActiveOrder));
  return (
    <LoaderCard title="Driver unloads in this order" description="Reverse of how you loaded">
      <ol className="flex flex-col divide-y divide-border">
        {stops.map((stop, i) => (
          <UnloadStop key={stop.stop_sequence} stop={stop} position={i} count={stops.length} />
        ))}
      </ol>
    </LoaderCard>
  );
}

function UnloadStop({ stop, position, count }: { stop: RunStop; position: number; count: number }) {
  const orders = stop.orders.filter(isActiveOrder).length;
  const where = position === 0 ? " · by the door" : position === count - 1 && count > 1 ? " · deepest" : "";
  const details = [
    stop.outlet.dock_type,
    `${formatClock(stop.outlet.window_start)}–${formatClock(stop.outlet.window_end)}`,
    stop.eta ? `ETA ${formatTime(stop.eta)}` : "ETA pending",
    `${orders} ${orders === 1 ? "order" : "orders"}`,
  ];
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          position === 0 ? "bg-primary text-primary-foreground" : "bg-background text-primary",
        )}
      >
        {position + 1}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
          {stop.outlet.code}
          {where}
          {stop.is_new && <LoaderPill tone="info">New</LoaderPill>}
        </span>
        <span className="text-xs text-muted-foreground">{details.join(" · ")}</span>
      </div>
    </li>
  );
}
