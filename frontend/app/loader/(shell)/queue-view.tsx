"use client";

import * as React from "react";
import { FilterChip } from "@/components/loader/filter-chip";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { MetricTile } from "@/components/loader/metric-tile";
import { RunCard } from "@/components/loader/run-card";
import { formatDay, greeting, queueMetrics, runAlert, type PlanSource } from "@/lib/loader/format";
import type { LoaderIssue, Run } from "@/lib/loader/types";

type BrandGroup = "fresh" | "style_tech";

interface QueueViewProps {
  runs: Run[];
  issues: LoaderIssue[];
  firstName: string;
  dockName: string;
  now: string;
  plan: PlanSource;
}

/** Loading queue built from mock data. Full behaviour arrives with L3. */
export function QueueView({ runs, issues, firstName, dockName, now, plan }: QueueViewProps) {
  const [group, setGroup] = React.useState<BrandGroup>("fresh");

  const sorted = [...runs].sort((a, b) => a.departs_at.localeCompare(b.departs_at));
  const fresh = sorted.filter((r) => r.brand === "fresh");
  const styleTech = sorted.filter((r) => r.brand !== "fresh");
  const shown = group === "fresh" ? fresh : styleTech;
  const metrics = queueMetrics(runs, issues);
  const heading = group === "fresh" ? "Fresh · night wave" : "Style & Tech";

  return (
    <LoaderScreen title="Loading queue" plan={plan}>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-primary">
              {greeting(now)}, {firstName}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              <InfoChip tone="primary">{formatDay(now)}</InfoChip>
            </div>
            <p className="text-xs text-muted-foreground">{dockName} · runs sorted by departure time.</p>
          </div>
          <div className="flex gap-2" role="group" aria-label="Brand">
            <FilterChip label="Fresh" count={fresh.length} active={group === "fresh"} onClick={() => setGroup("fresh")} />
            <FilterChip
              label="Style & Tech"
              count={styleTech.length}
              active={group === "style_tech"}
              onClick={() => setGroup("style_tech")}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile label="Runs" value={metrics.runs} caption={`At ${dockName} today`} />
          <MetricTile label="Loading" value={metrics.loading} caption={metrics.loadingCaption} />
          <MetricTile label="Issues" value={metrics.issues} caption={metrics.issuesCaption} />
          <MetricTile label="Ready" value={metrics.ready} caption={metrics.readyCaption} />
        </div>

        <section aria-labelledby="queue-heading" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 id="queue-heading" className="text-base font-semibold text-primary">
              {heading}
            </h2>
            <span className="text-xs text-muted-foreground">{shown.length} runs</span>
          </div>
          {shown.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {shown.map((run) => (
                <RunCard key={run.run_code} run={run} alert={runAlert(run, issues)} />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              No {heading} runs at {dockName} today.
            </p>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Once a driver leaves the gate the run drops off this list and shows as In Transit on the
          Dispatcher&apos;s Today&apos;s Trips.
        </p>
      </div>
    </LoaderScreen>
  );
}
