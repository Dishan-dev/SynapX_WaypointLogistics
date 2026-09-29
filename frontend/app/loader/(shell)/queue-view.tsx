"use client";

import * as React from "react";
import { FilterChip } from "@/components/loader/filter-chip";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { MetricTile } from "@/components/loader/metric-tile";
import { RunCard } from "@/components/loader/run-card";
import { greeting, type PlanSource } from "@/lib/loader/format";
import type { QueueSummary, RunGroup, RunQueue } from "@/lib/loader/types";

type BrandFilter = "fresh" | "style_tech";

const inFilter = (group: RunGroup, filter: BrandFilter) =>
  filter === "fresh" ? group.brand === "fresh" : group.brand !== "fresh";

const runCount = (groups: RunGroup[]) => groups.reduce((n, g) => n + g.runs.length, 0);

interface QueueViewProps {
  /** GET /loader/runs */
  queue: RunQueue;
  /** GET /loader/summary */
  summary: QueueSummary;
  now: string;
  plan: PlanSource;
}

/** Loading queue built from mock data. Full behaviour arrives with L3. */
export function QueueView({ queue, summary, now, plan }: QueueViewProps) {
  const firstName = useLoaderShell().user.name.split(" ")[0];
  const [filter, setFilter] = React.useState<BrandFilter>("fresh");

  const fresh = queue.groups.filter((g) => inFilter(g, "fresh"));
  const styleTech = queue.groups.filter((g) => inFilter(g, "style_tech"));
  const shown = filter === "fresh" ? fresh : styleTech;

  return (
    <LoaderScreen title="Loading queue" plan={plan}>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-primary">
              {greeting(now)}, {firstName}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <InfoChip tone="primary">{summary.day_label}</InfoChip>
              {summary.next_holiday && <InfoChip tone="warning">{summary.next_holiday.label}</InfoChip>}
            </div>
            <p className="text-xs text-muted-foreground">{summary.dock} · runs sorted by departure time.</p>
          </div>
          <div className="flex gap-2" role="group" aria-label="Brand">
            <FilterChip
              label="Fresh"
              count={runCount(fresh)}
              active={filter === "fresh"}
              onClick={() => setFilter("fresh")}
            />
            <FilterChip
              label="Style & Tech"
              count={runCount(styleTech)}
              active={filter === "style_tech"}
              onClick={() => setFilter("style_tech")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Runs" value={summary.runs} caption={`At ${summary.dock} today`} />
          <MetricTile label="Loading" value={summary.loading.count} caption={summary.loading.loaders.join(", ")} />
          <MetricTile label="Issues" value={summary.issues.count} caption={summary.issues.label} />
          <MetricTile label="Ready" value={summary.ready.count} caption={summary.ready.run_codes.join(", ")} />
        </div>

        {shown.length ? (
          shown.map((group) => (
            <section key={group.label} aria-label={group.label} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-primary">{group.label}</h2>
                <span className="text-xs text-muted-foreground">{group.runs.length} runs</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.runs.map((run) => (
                  <RunCard key={run.code} run={run} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No runs at {summary.dock} for this filter today.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Once a driver leaves the gate the run drops off this list and shows as In Transit on the
          Dispatcher&apos;s Today&apos;s Trips.
        </p>
      </div>
    </LoaderScreen>
  );
}
