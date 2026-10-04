"use client";

import { useState } from "react";
import { Snowflake, Truck } from "lucide-react";
import { openFlagSheet } from "@/components/loader/flag-issue-sheet";
import { LoaderAppBar } from "@/components/loader/loader-app-bar";
import { LoaderBottomNav } from "@/components/loader/loader-bottom-nav";
import { PlanSourceStrip } from "@/components/loader/plan-source-strip";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { RunCard } from "@/components/loader/run-card";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { useLoaderSync, useOfflineRun } from "@/components/loader/loader-sync-provider";
import { LoaderTile } from "@/components/loader/loader-tile";
import { PinKey } from "@/components/loader/pin-key";
import { SearchInput } from "@/components/loader/search-input";
import { SuggestionRow } from "@/components/loader/suggestion-row";
import { AlertRow } from "@/components/loader/alert-row";
import { DecisionOption } from "@/components/loader/decision-option";
import { MetricTile } from "@/components/loader/metric-tile";
import { TrackerStep } from "@/components/loader/tracker-step";
import { CapacityCard } from "@/components/loader/capacity-card";
import { LoadMap } from "@/components/loader/load-map";
import { LoaderCard } from "@/components/loader/loader-card";
import { FilterChip } from "@/components/loader/filter-chip";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderButton } from "@/components/loader/loader-button";
import { LoaderPill } from "@/components/loader/loader-pill";
import { OrderRow } from "@/components/loader/order-row";
import { StopHeader } from "@/components/loader/stop-header";
import { TempBadge } from "@/components/loader/temp-badge";
import { dockPlanSource, loadMapSlots, planSource, runCapacity, stopsInLoadOrder } from "@/lib/loader/format";
import { decideMockIssue, newestWaitingMockIssue, simulateMockPlanChange } from "@/lib/loader/offline/transport";
import { mockQueue, mockRunDetails } from "@/lib/loader/mock-data";
import type { OrderState, RunOrder } from "@/lib/loader/types";

// The plan-change button drives the mock server only; on the API use
// POST /loader/dev/runs/{code}/plan-change instead.
const MOCK_TRANSPORT = process.env.NEXT_PUBLIC_LOADER_TRANSPORT !== "api";

const states: OrderState[] = ["to_load", "loaded", "flagged", "re_check", "take_off", "moved", "new"];

const sample = (state: OrderState): RunOrder => ({
  order_number: "ORD0092300",
  temperature_class: "chilled",
  units: 26,
  weight_kg: 380,
  volume_m3: 1.9,
  state,
  checked_at: null,
  checked_by: null,
  note: "Note",
  changed_in_version: state === "moved" ? 3 : undefined,
});

/** Every loader component with mock data, for checking against Figma. Dev only. */
export function KitView() {
  const initialRun = mockRunDetails[0];
  const [query, setQuery] = useState("");
  const [pin, setPin] = useState("");
  const [picked, setPicked] = useState(false);
  // re_check rows: the checklist sends check; recheck is the explicit write.
  const [recheckVerb, setRecheckVerb] = useState<"check" | "recheck">("check");
  const { user } = useLoaderShell();
  const { sync, flush } = useLoaderSync();
  const offline = useOfflineRun(initialRun, user.shortName);
  // Capacity and counts follow local actions (recomputed after each tap).
  const run = offline.run;
  const cap = runCapacity(run);
  return (
    <LoaderScreen title="Component kit" plan={planSource(run)}>
    <div className="mx-auto max-w-3xl space-y-8">
      <section aria-labelledby="offline-test" className="space-y-3 rounded-xl border border-dashed border-border p-4">
        <h2 id="offline-test" className="text-base font-semibold text-primary">
          Offline test · {run.code}
        </h2>
        <p className="text-xs text-muted-foreground" data-testid="sync-summary">
          online={String(sync.online)} · pending={sync.pending} · stale={sync.stale} · failed={sync.failed} · syncing={String(sync.syncing)} ·
          loaded={run.orders_loaded} · checked={run.orders_checked}/{run.orders_total} · source={offline.source}
        </p>
        {stopsInLoadOrder(run.stops).map((stop) =>
          stop.orders.map((o) => (
            <OrderRow
              key={o.order_number}
              order={o}
              onToggle={(order) =>
                void offline.act(
                  order.state === "loaded" ? "uncheck" : order.state === "re_check" ? recheckVerb : "check",
                  { order_number: order.order_number },
                )
              }
              onFlag={(order) => openFlagSheet(run, order, offline.act)}
            />
          )),
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-12 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={recheckVerb === "recheck"}
              onChange={(e) => setRecheckVerb(e.target.checked ? "recheck" : "check")}
            />
            Send recheck for re_check rows
          </label>
          {MOCK_TRANSPORT && (
            <LoaderButton
              variant="secondary"
              onClick={() => {
                simulateMockPlanChange(run.code);
                void flush();
              }}
            >
              Simulate plan change
            </LoaderButton>
          )}
          {MOCK_TRANSPORT && (
            <>
              <LoaderButton
                variant="secondary"
                onClick={() => {
                  const issue = newestWaitingMockIssue();
                  // The Dispatcher picks the default ("Send N of M" for short and damaged).
                  if (issue) decideMockIssue(issue.id, (issue.options.find((o) => o.is_default) ?? issue.options[0])?.label);
                  void flush();
                }}
              >
                Dispatcher answers
              </LoaderButton>
              <LoaderButton
                variant="secondary"
                onClick={() => {
                  const issue = newestWaitingMockIssue();
                  if (issue) decideMockIssue(issue.id);
                  void flush();
                }}
              >
                Decide-by passes
              </LoaderButton>
            </>
          )}
          {run.unacknowledged_plan_version !== null && (
            <LoaderButton onClick={() => void offline.act("acknowledge")}>
              Acknowledge v{run.unacknowledged_plan_version}
            </LoaderButton>
          )}
        </div>
        {offline.rejected.length > 0 && (
          <div className="space-y-2">
            <ul className="space-y-1 text-xs text-muted-foreground" data-testid="rejected-actions">
              {offline.rejected.map((a) => (
                <li key={a.client_action_id}>
                  {a.action_type} {"order_number" in a.payload ? a.payload.order_number : ""} · v{a.plan_version} ·{" "}
                  {a.conflict_code ?? a.status}
                  {a.current_plan_version !== undefined && ` (now v${a.current_plan_version})`}
                </li>
              ))}
            </ul>
            <LoaderButton variant="ghost" onClick={() => void offline.dismissRejected()}>
              Dismiss
            </LoaderButton>
          </div>
        )}
      </section>
      <section className="overflow-hidden rounded-lg border border-border">
        <LoaderAppBar title="Loading checklist" subtitle={`${run.code} · ${run.dock} · Saman J.`} hasUnread />
        <PlanSourceStrip plan={planSource(run)} sync={{ online: true, pending: 0, syncing: false, stale: 0, failed: 0 }} />
        <PlanSourceStrip plan={planSource(run)} sync={{ online: false, pending: 3, syncing: false, stale: 0, failed: 0 }} />
        <PlanSourceStrip plan={planSource(run)} sync={{ online: true, pending: 3, syncing: true, stale: 0, failed: 0 }} />
        <PlanSourceStrip plan={dockPlanSource([run])} sync={{ online: true, pending: 0, syncing: false, stale: 0, failed: 1 }} />
        <PlanSourceStrip plan={planSource(run)} sync={{ online: true, pending: 0, syncing: false, stale: 2, failed: 0 }} />
        <div className="h-4" />
        <LoaderBottomNav active="loading" loadingHref="/loader/runs/RUN-021" issueCount={1} />
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <SearchInput label="Loader name" placeholder="Type your name…" value={query} onChange={setQuery} />
          <div className="overflow-hidden rounded-lg border border-border">
            <SuggestionRow initials="SJ" name="Saman Jayawardena" detail="Loader · Peliyagoda DC" highlighted onSelect={() => {}} />
            <SuggestionRow initials="TJ" name="Tharindu Jayasuriya" detail="Loader · Peliyagoda DC" highlighted={false} onSelect={() => {}} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LoaderTile initials="SJ" name="Saman J." selected={picked} onSelect={() => setPicked(!picked)} />
            <LoaderTile initials="NS" name="Nimal S." selected={false} onSelect={() => {}} />
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-center text-2xl font-bold tracking-[0.5em] text-primary" aria-live="polite">{pin.replace(/./g, "•") || "—"}</p>
          <div className="grid grid-cols-3 gap-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "backspace"].map((k, i) =>
              k ? (
                <PinKey key={k} value={k} onPress={(v) => setPin(v === "backspace" ? pin.slice(0, -1) : (pin + v).slice(0, 4))} />
              ) : (
                <span key={`blank-${i}`} />
              ),
            )}
          </div>
        </div>
      </section>
      <section aria-label="Run cards" className="grid gap-3 md:grid-cols-2">
        {mockQueue.docks.flatMap((d) => d.runs).map((r) => (
          <RunCard key={r.code} run={r} />
        ))}
      </section>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricTile label="Runs" value={5} caption="At Peliyagoda DC today" />
        <MetricTile label="Loading" value={2} caption="Saman, Tharindu" />
        <MetricTile label="Issues" value={1} caption="Awaiting decision" />
        <MetricTile label="Ready" value={1} caption="RUN-022" />
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        <AlertRow tone="error" message="ORD0092314 missing · waiting" actionLabel="Open" onAction={() => {}} />
        <AlertRow tone="warning" message="Plan updated 02:14 · v2 → v3" actionLabel="Review" onAction={() => {}} />
        <AlertRow tone="neutral" message="Pre-stage ambient pallets at Bay 2" actionLabel="Open" onAction={() => {}} />
        <AlertRow tone="success" message="Signed off · driver can collect" actionLabel="View" onAction={() => {}} />
        <AlertRow tone="info" message="Alert message" actionLabel="Action" onAction={() => {}} />
      </section>
      <section className="grid gap-4 md:grid-cols-2">
        <ul className="space-y-3">
          <DecisionOption title="Send without it" description="Defer to Fri 29 May. OUT003 gets its dry order only." chosen={false} />
          <DecisionOption title="Send without it" description="Defer to Fri 29 May. OUT003 gets its dry order only." chosen />
        </ul>
        <ol className="grid grid-cols-3 gap-2">
          <TrackerStep state="done" label="Sent" time="02:03" />
          <TrackerStep state="done" label="Seen" time="02:05" />
          <TrackerStep state="pending" label="Decision" time="by 02:33" />
        </ol>
      </section>
      <section className="grid items-start gap-4 md:grid-cols-[248px_1fr]">
        <div className="space-y-4">
          <CapacityCard {...cap} />
          <LoaderCard title="Load map" description="Cab to door, as seen from the dock">
            <LoadMap slots={loadMapSlots(run)} spareM3={cap.spareM3} />
          </LoaderCard>
        </div>
        <LoaderCard title="Truck, cab to door" description="5 of 7 orders in">
          <LoadMap slots={loadMapSlots(run)} spareM3={cap.spareM3} orientation="horizontal" />
        </LoaderCard>
      </section>
      <section className="flex flex-wrap gap-3">
        <LoaderButton>Button</LoaderButton>
        <LoaderButton variant="secondary">Button</LoaderButton>
        <LoaderButton variant="ghost">Button</LoaderButton>
        <LoaderButton variant="destructive">Button</LoaderButton>
        <LoaderButton disabled>Button</LoaderButton>
        <LoaderButton locked>Release locked</LoaderButton>
      </section>
      <section className="flex flex-wrap gap-3">
        <LoaderPill tone="primary">Primary</LoaderPill>
        <LoaderPill tone="info">Info</LoaderPill>
        <LoaderPill tone="success">Success</LoaderPill>
        <LoaderPill tone="warning">Warning</LoaderPill>
        <LoaderPill tone="error">Error</LoaderPill>
        <LoaderPill tone="neutral">Neutral</LoaderPill>
        <TempBadge temp="chilled" />
        <TempBadge temp="ambient" />
      </section>
      <section className="flex flex-wrap gap-3">
        <FilterChip label="Fresh" count={4} active />
        <FilterChip label="Fresh" count={4} active={false} />
        <InfoChip icon={<Truck />}>Truck</InfoChip>
        <InfoChip tone="info" icon={<Snowflake />}>Reefer</InfoChip>
        <InfoChip tone="primary">Thu 28 May</InfoChip>
        <InfoChip tone="warning">van_only</InfoChip>
      </section>
      <section className="grid gap-3 md:grid-cols-2">
        {states.map((s) => (
          <OrderRow key={s} order={sample(s)} onFlag={() => {}} />
        ))}
      </section>
      <section className="space-y-3">
        {stopsInLoadOrder(run.stops).map((stop) => (
          <div key={stop.stop_sequence} className="space-y-2">
            <StopHeader stop={stop} stopCount={run.stops.length} />
            {stop.orders.map((o) => (
              <OrderRow key={o.order_number} order={o} onFlag={() => {}} />
            ))}
          </div>
        ))}
      </section>
    </div>
    </LoaderScreen>
  );
}
