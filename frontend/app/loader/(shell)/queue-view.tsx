"use client";

import * as React from "react";
import { WifiOff } from "lucide-react";
import { FilterChip } from "@/components/loader/filter-chip";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { MetricTile } from "@/components/loader/metric-tile";
import { RunCard } from "@/components/loader/run-card";
import { Skeleton } from "@/components/ui/skeleton";
import { depotName, formatTime, greeting, type PlanSource } from "@/lib/loader/format";
import { mockNow } from "@/lib/loader/mock-data";
import type { DockQueue, QueueSummary, RunQueue, RunSummary } from "@/lib/loader/types";
import { useLiveQueue } from "./use-live-queue";
import { usePick } from "./use-pick";

type BrandFilter = "fresh" | "style_tech";

const FILTER_KEY = "waypoint-loader-queue-filter";
// The mock scenario is set at 02:20 on 28 May; the API runs on the real clock.
const MOCK_TRANSPORT = process.env.NEXT_PUBLIC_LOADER_TRANSPORT !== "api";

const inFilter = (run: RunSummary, filter: BrandFilter) =>
  filter === "fresh" ? run.brand === "fresh" : run.brand !== "fresh";

/** Each dock with only the runs in the filter. */
const filtered = (docks: DockQueue[], filter: BrandFilter) =>
  docks.map((dock) => ({ ...dock, runs: dock.runs.filter((run) => inFilter(run, filter)) }));

const runCount = (docks: DockQueue[]) => docks.reduce((n, d) => n + d.runs.length, 0);

/** The filter this tablet used last (a per-tablet convenience). */
function savedFilter(): BrandFilter {
  try {
    return window.localStorage.getItem(FILTER_KEY) === "style_tech" ? "style_tech" : "fresh";
  } catch {
    return "fresh";
  }
}

/**
 * Loading queue (Figma 1b, 1b.1, 7, 13, 19 · tablet T1b): every dock of the
 * signed-in depot with the trucks that have arrived, metric cards, brand
 * filter, each run's alert and who is loading it. A free run is picked here.
 */
export function QueueView() {
  const live = useLiveQueue();
  const { refresh } = live;
  // A picked run opens its checklist; otherwise (taken first, offline) the
  // queue reloads so the card shows who has it.
  const picked = usePick();
  const { pick } = picked;
  const onPick = React.useCallback(
    (code: string) =>
      void pick(code).then((run) => {
        if (!run) void refresh();
      }),
    [pick, refresh],
  );
  const firstName = useLoaderShell().user.name.split(" ")[0];
  const [now] = React.useState(() => (MOCK_TRANSPORT ? mockNow : new Date().toISOString()));
  const [filter, setFilterState] = React.useState<BrandFilter>(savedFilter);
  // The time is the summary's plan_updated_at (latest plan publish across the
  // dock). None until the summary arrives, and none when it is null.
  const stripPlan: PlanSource = {
    source: "Dispatcher",
    updatedAt: (live.status === "ready" && live.summary.plan_updated_at) || undefined,
  };

  const setFilter = (next: BrandFilter) => {
    setFilterState(next);
    try {
      window.localStorage.setItem(FILTER_KEY, next);
    } catch {
      // Storage blocked: the filter resets on reload.
    }
  };

  return (
    <LoaderScreen title="Loading queue" plan={stripPlan}>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        {live.status === "ready" ? (
          <QueueContent
            queue={live.queue}
            summary={live.summary}
            offlineSince={live.source === "cache" ? live.fetchedAt : undefined}
            heading={`${greeting(now)}, ${firstName}`}
            filter={filter}
            onFilter={setFilter}
            onPick={onPick}
            picking={picked.picking}
            notice={picked.notice}
          />
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-primary">
              {greeting(now)}, {firstName}
            </h2>
            {live.status === "loading" ? <QueueSkeleton /> : <QueueUnavailable />}
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Once a driver leaves the gate the run drops off this list and shows as In Transit on the
          Dispatcher&apos;s Today&apos;s Trips.
        </p>
      </div>
    </LoaderScreen>
  );
}

function QueueContent({
  queue,
  summary,
  offlineSince,
  heading,
  filter,
  onFilter,
  onPick,
  picking,
  notice,
}: {
  queue: RunQueue;
  summary: QueueSummary;
  offlineSince?: string;
  heading: string;
  filter: BrandFilter;
  onFilter: (filter: BrandFilter) => void;
  onPick: (code: string) => void;
  picking?: string;
  notice?: string;
}) {
  const fresh = filtered(queue.docks, "fresh");
  const styleTech = filtered(queue.docks, "style_tech");
  const shown = (filter === "fresh" ? fresh : styleTech).filter((dock) => dock.runs.length > 0);
  const depot = depotName(summary.depot);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-primary">{heading}</h2>
          <div className="flex flex-wrap gap-1.5">
            <InfoChip tone="primary">{summary.day_label}</InfoChip>
            {summary.next_holiday && <InfoChip tone="warning">{summary.next_holiday.label}</InfoChip>}
            {offlineSince && (
              <InfoChip tone="warning" icon={<WifiOff />}>
                Offline · as of {formatTime(offlineSince)}
              </InfoChip>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{depot} · every dock · trucks in order of arrival.</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Brand">
          <FilterChip label="Fresh" count={runCount(fresh)} active={filter === "fresh"} onClick={() => onFilter("fresh")} />
          <FilterChip
            label="Style & Tech"
            count={runCount(styleTech)}
            active={filter === "style_tech"}
            onClick={() => onFilter("style_tech")}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile label="Runs" value={summary.runs} caption={`At ${depot} today`} />
        <MetricTile label="Loading" value={summary.loading.count} caption={summary.loading.loaders.join(", ")} />
        <MetricTile label="Issues" value={summary.issues.count} caption={summary.issues.label} />
        <MetricTile label="Ready" value={summary.ready.count} caption={summary.ready.run_codes.join(", ")} />
      </div>

      {notice && (
        <p role="alert" className="rounded-lg border border-warning/40 bg-warning-muted px-4 py-3 text-sm text-warning-muted-foreground">
          {notice}
        </p>
      )}

      {shown.length ? (
        shown.map((dock) => (
          <section key={dock.dock_code} aria-label={dock.dock} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-base font-semibold text-primary">{dock.dock}</h2>
              <span className="text-xs text-muted-foreground">
                {dock.runs.length} {dock.runs.length === 1 ? "truck" : "trucks"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {dock.runs.map((run) => (
                <RunCard key={run.code} run={run} onPick={onPick} picking={picking === run.code} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          No trucks at {depot} for this filter yet. A run shows here once its driver says the truck is at the dock.
        </p>
      )}
    </>
  );
}

function QueueSkeleton() {
  return (
    <div role="status" aria-label="Loading the queue" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

function QueueUnavailable() {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-dashed border-border bg-card p-6 text-center">
      <p className="text-base font-semibold text-primary">The queue isn’t on this tablet yet.</p>
      <p className="text-sm text-muted-foreground">Reconnect to load today’s runs. Queued checks are kept.</p>
    </div>
  );
}
