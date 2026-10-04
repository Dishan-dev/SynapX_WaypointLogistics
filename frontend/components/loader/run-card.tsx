import * as React from "react";
import Link from "next/link";
import { Snowflake, Truck } from "lucide-react";
import { cn } from "cn";
import { runCardView, type RunChipKind } from "@/lib/loader/format";
import type { RunStatus, RunSummary } from "@/lib/loader/types";
import { AlertRow } from "./alert-row";
import { InfoChip, type InfoChipTone } from "./info-chip";
import { LoaderButton } from "./loader-button";
import { LoaderPill, type LoaderPillTone } from "./loader-pill";

const statusPill: Record<RunStatus, { tone: LoaderPillTone; label: string }> = {
  not_started: { tone: "neutral", label: "Not started" },
  loading: { tone: "warning", label: "Loading" },
  issue_flagged: { tone: "error", label: "Issue flagged" },
  loaded: { tone: "primary", label: "Loaded" },
  ready_to_depart: { tone: "success", label: "Ready to depart" },
  gated_out: { tone: "neutral", label: "Gated out" },
};

const chipStyle: Record<RunChipKind, { tone: InfoChipTone; icon?: React.ReactNode }> = {
  vehicle: { tone: "neutral", icon: <Truck /> },
  reefer: { tone: "info", icon: <Snowflake /> },
  access: { tone: "warning" },
  plain: { tone: "neutral" },
};

interface RunCardProps {
  /** One run from GET /loader/runs; chips and alert come from the data. */
  run: RunSummary;
  /** Pick a free run (POST /loader/runs/{code}/pick). */
  onPick?: (code: string) => void;
  /** True while this card's pick is with the server. */
  picking?: boolean;
  className?: string;
}

/**
 * Run on the loading queue: departure, status, vehicle, progress and its
 * alert. A free run has a Pick button; yours opens; another loader's is
 * greyed out with no link ("Saman J. is loading").
 */
export function RunCard({ run, onPick, picking = false, className }: RunCardProps) {
  const view = runCardView(run);
  const status = statusPill[view.status];
  const ready = view.status === "ready_to_depart";
  const other = view.pick === "other";

  return (
    <article
      className={cn("flex flex-col gap-3 rounded-xl border border-border bg-card p-4", other && "opacity-60", className)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-primary">{view.departs}</span>
          <span className="text-sm text-muted-foreground">departs</span>
        </p>
        <LoaderPill tone={status.tone}>{status.label}</LoaderPill>
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="text-base font-semibold text-foreground">
          {view.pick === "mine" ? (
            <Link
              href={`/loader/runs/${view.code}`}
              className="rounded-sm outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {view.title}
            </Link>
          ) : (
            view.title
          )}
        </h3>
        <p className="text-sm text-muted-foreground">{view.subtitle}</p>
        {view.arrived && <p className="text-sm text-muted-foreground">{view.arrived}</p>}
        {view.pickNote && (
          <p className={cn("text-sm font-semibold", other ? "text-muted-foreground" : "text-primary")}>{view.pickNote}</p>
        )}
      </div>

      {view.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {view.chips.map((chip) => (
            <InfoChip key={chip.label} tone={chipStyle[chip.kind].tone} icon={chipStyle[chip.kind].icon}>
              {chip.label}
            </InfoChip>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div
          role="progressbar"
          aria-label={`${view.code} loading progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.progress}
          className="h-1 overflow-hidden rounded-full bg-border"
        >
          <div
            className={cn("h-full", ready ? "bg-success" : "bg-primary")}
            style={{ width: `${view.progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground">{view.progressNote}</p>
      </div>

      {view.alert && (
        <AlertRow
          tone={view.alert.tone}
          message={view.alert.message}
          actionLabel={view.alert.actionLabel}
          actionHref={view.alert.actionHref}
        />
      )}

      {view.pick === "free" && onPick && (
        <LoaderButton className="w-full" disabled={picking} onClick={() => onPick(view.code)}>
          {picking ? "Picking…" : `Pick ${view.code}`}
        </LoaderButton>
      )}
    </article>
  );
}
