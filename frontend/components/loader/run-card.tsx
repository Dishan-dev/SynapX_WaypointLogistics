import Link from "next/link";
import { Snowflake, Truck } from "lucide-react";
import { cn } from "cn";
import { runSummary, type RunAlert } from "@/lib/loader/format";
import type { Run, RunStatus } from "@/lib/loader/types";
import { AlertRow } from "./alert-row";
import { InfoChip } from "./info-chip";
import { LoaderPill, type LoaderPillTone } from "./loader-pill";

const statusPill: Record<RunStatus, { tone: LoaderPillTone; label: string }> = {
  not_started: { tone: "neutral", label: "Not started" },
  loading: { tone: "warning", label: "Loading" },
  issue_flagged: { tone: "error", label: "Issue flagged" },
  loaded: { tone: "primary", label: "Loaded" },
  ready_to_depart: { tone: "success", label: "Ready to depart" },
  gated_out: { tone: "neutral", label: "Gated out" },
};

interface RunCardProps {
  run: Run;
  alert?: RunAlert;
  className?: string;
}

/** Run on the loading queue: departure, status, vehicle, progress and its alert. */
export function RunCard({ run, alert, className }: RunCardProps) {
  const summary = runSummary(run);
  const status = statusPill[summary.status];
  const ready = summary.status === "ready_to_depart";

  return (
    <article className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-primary">{summary.departs}</span>
          <span className="text-sm text-muted-foreground">departs</span>
        </p>
        <LoaderPill tone={status.tone}>{status.label}</LoaderPill>
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold text-foreground">
          <Link
            href={`/loader/runs/${summary.runCode}`}
            className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {summary.title}
          </Link>
        </h3>
        <p className="text-sm text-muted-foreground">{summary.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <InfoChip icon={<Truck />}>{summary.vehicleLabel}</InfoChip>
        {summary.reefer && (
          <InfoChip tone="info" icon={<Snowflake />}>
            Reefer
          </InfoChip>
        )}
        {summary.vanOnly ? (
          <InfoChip tone="warning">van_only</InfoChip>
        ) : (
          <InfoChip>{summary.capacityLabel}</InfoChip>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-label={`${summary.runCode} loading progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={summary.progress}
          className="h-1 overflow-hidden rounded-full bg-border"
        >
          <div
            className={cn("h-full", ready ? "bg-success" : "bg-primary")}
            style={{ width: `${summary.progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{summary.progressNote}</p>
      </div>

      {alert && (
        <AlertRow
          tone={alert.tone}
          message={alert.message}
          actionLabel={alert.actionLabel}
          actionHref={alert.actionHref}
        />
      )}
    </article>
  );
}
