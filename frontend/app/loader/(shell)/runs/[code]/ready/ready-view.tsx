"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Snowflake, Truck } from "lucide-react";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderButton } from "@/components/loader/loader-button";
import { LoaderPill } from "@/components/loader/loader-pill";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { useLoaderSync, useOfflineRun } from "@/components/loader/loader-sync-provider";
import { formatTime, planSource, releasedByName, UNDO_WINDOW_MS, undoRefusal } from "@/lib/loader/format";
import type { Run } from "@/lib/loader/types";
import { RunGate } from "../review/run-gate";

const BRAND_LABELS = { fresh: "Fresh", style: "Style", tech: "Tech" } as const;

/**
 * The strip on a released run: "Ready to depart · released by Saman J. · 03:06"
 * from the run read, or just "Ready to depart" without both. It carries who and
 * when, so the card below does not repeat them. Figma 1f says "Sent to Driver
 * and Dispatcher" here; nothing tells them yet, so that is not claimed.
 */
function readyStripText(run: Run): string {
  const by = releasedByName(run);
  return by && run.released_at
    ? `Ready to depart · released by ${by} · ${formatTime(run.released_at)}`
    : "Ready to depart";
}

export function ReadyView({ code }: { code: string }) {
  return (
    <RunGate code={code} title="Confirm & release">
      {(run) => <Ready initial={run} />}
    </RunGate>
  );
}

/**
 * Ready to depart (Figma 1f, 12, 18 · T1f): who signed the run off, and a
 * 10 s undo counted from released_at.
 */
function Ready({ initial }: { initial: Run }) {
  const router = useRouter();
  const { user, dockLabel } = useLoaderShell();
  const { sync, checkConnection } = useLoaderSync();
  const { run, act, rejected, dismissRejected } = useOfflineRun(initial, user.shortName);
  const [now, setNow] = React.useState(() => Date.now());

  const ready = run.status === "ready_to_depart";
  const releasedAt = run.released_at ? Date.parse(run.released_at) : undefined;
  const secondsLeft = releasedAt === undefined ? 0 : Math.ceil((UNDO_WINDOW_MS - (now - releasedAt)) / 1000);
  const canUndo = ready && secondsLeft > 0;
  const undoRefused = rejected.find((a) => a.action_type === "release_undo");
  const refusal = undoRefusal(undoRefused?.conflict_code);
  const dockName = dockLabel.split(" · ").pop() ?? dockLabel;
  const stopCount = run.stops.length;

  // Tick while the undo window is open.
  React.useEffect(() => {
    if (!canUndo) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [canUndo]);

  const undo = async () => {
    // Like release, undo is never queued for later.
    if (!(await checkConnection())) return;
    const action = await act("release_undo");
    if (action) router.push(`/loader/runs/${encodeURIComponent(run.code)}/review`);
  };

  const footer = (
    <div className="flex flex-col gap-2">
      <LoaderButton className="w-full" onClick={() => router.push("/loader")}>
        Back to loading queue
      </LoaderButton>
      {canUndo &&
        (sync.online ? (
          <LoaderButton variant="ghost" className="w-full" onClick={() => void undo()}>
            Undo · {secondsLeft} s
          </LoaderButton>
        ) : (
          <LoaderButton variant="ghost" className="w-full" locked>
            Undo needs a connection · {secondsLeft} s
          </LoaderButton>
        ))}
    </div>
  );

  return (
    <LoaderScreen
      title="Confirm & release"
      subtitle={`${run.code} · ${dockName} · ${user.shortName}`}
      plan={planSource(run)}
      stripText={ready ? readyStripText(run) : undefined}
      footer={footer}
    >
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <header className="flex flex-col gap-1.5">
          <nav aria-label="Breadcrumb" className="text-xs leading-[17px] font-medium text-muted-foreground">
            <Link href="/loader" className="hover:underline">
              Queue
            </Link>
            {` / ${run.code}`}
          </nav>
          <h1 className="text-xl leading-[26px] font-semibold text-primary">
            {run.vehicle.code} · Trip {run.trip_number}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <LoaderPill tone={ready ? "success" : "warning"}>{ready ? "Ready to depart" : "Not ready"}</LoaderPill>
            <InfoChip icon={<Truck />}>{run.vehicle.vehicle_type === "van" ? "Van" : "Truck"}</InfoChip>
            {run.vehicle.temp_capability === "reefer" && (
              <InfoChip tone="info" icon={<Snowflake />}>
                Reefer
              </InfoChip>
            )}
          </div>
          <p className="text-xs leading-[17px] text-muted-foreground">
            {BRAND_LABELS[run.brand]} · {run.district} · {stopCount} {stopCount === 1 ? "stop" : "stops"} · departs{" "}
            {formatTime(run.departs_at)}
          </p>
        </header>

        {undoRefused && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive-muted px-4 py-3">
            <p className="text-sm font-semibold text-destructive">{refusal.title}</p>
            <p className="text-sm text-foreground">{refusal.body}</p>
            <LoaderButton variant="ghost" className="w-fit" onClick={() => void dismissRejected()}>
              OK
            </LoaderButton>
          </div>
        )}

        {ready ? (
          <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-4 py-6 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-success-muted text-success">
              <Check className="size-8" aria-hidden />
            </span>
            <h2 className="text-xl font-semibold text-primary">Ready to depart</h2>
            <p
              role="status"
              className="w-full rounded-lg bg-success-muted px-4 py-3 text-sm font-semibold text-success"
            >
              {sync.pending > 0 ? "Saving…" : "Release saved"}
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-base font-semibold text-primary">{run.code} is not ready to depart.</p>
            <p className="text-sm text-muted-foreground">
              It was undone, or a plan change reopened it. Finish the checklist, then release again.
            </p>
            <Link
              href={`/loader/runs/${encodeURIComponent(run.code)}`}
              className="text-sm font-medium text-info underline-offset-4 hover:underline"
            >
              Open the checklist
            </Link>
          </section>
        )}
      </div>
    </LoaderScreen>
  );
}
