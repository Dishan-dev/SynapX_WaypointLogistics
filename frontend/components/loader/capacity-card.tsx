import { cn } from "cn";
import { formatKg, formatM3, percentOf } from "@/lib/loader/format";
import { LoaderCard } from "./loader-card";

const formatKgValue = (kg: number) => kg.toLocaleString("en-US");
const formatM3Value = (m3: number) => m3.toFixed(1);

export interface CapacityMeasure {
  /** Already on the vehicle. */
  loaded: number;
  /** Everything on the current plan. */
  planned: number;
  /** Vehicle limit. */
  max: number;
}

interface CapacityCardProps {
  vehicleCode: string;
  planVersion: number;
  weight: CapacityMeasure;
  volume: CapacityMeasure;
  className?: string;
}

const NEAR_FULL_PERCENT = 90;

function CapacityBar({
  label,
  measure,
  format,
  formatValue,
  planVersion,
}: {
  label: string;
  measure: CapacityMeasure;
  /** Value with unit, e.g. "4,690 kg". */
  format: (n: number) => string;
  /** Bare value, e.g. "3,410". */
  formatValue: (n: number) => string;
  planVersion: number;
}) {
  const plannedPct = percentOf(measure.planned, measure.max);
  const over = measure.planned > measure.max;
  const width = (n: number) => `${Math.min(100, (n / measure.max) * 100)}%`;

  let planNote = `Plan v${planVersion} ${format(measure.planned)} · ${plannedPct}%`;
  if (over) planNote += ` · over by ${format(Math.round((measure.planned - measure.max) * 10) / 10)}`;
  else if (plannedPct >= NEAR_FULL_PERCENT) planNote += " · near full";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 whitespace-nowrap">
        <span className="text-xs leading-[17px] text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">
          {formatValue(measure.loaded)} / {format(measure.max)}
        </span>
      </div>
      <div
        role="meter"
        aria-label={`${label} loaded`}
        aria-valuemin={0}
        aria-valuemax={measure.max}
        aria-valuenow={measure.loaded}
        aria-valuetext={`${format(measure.loaded)} of ${format(measure.max)} loaded; ${planNote}`}
        className="relative h-2 overflow-hidden rounded-sm bg-border"
      >
        <div
          className={cn("absolute inset-y-0 left-0", over ? "bg-destructive/40" : "bg-primary/25")}
          style={{ width: width(measure.planned) }}
        />
        <div className="absolute inset-y-0 left-0 bg-primary" style={{ width: width(measure.loaded) }} />
      </div>
      <p className={cn("text-xs leading-[17px]", over ? "font-medium text-destructive" : "text-muted-foreground")}>
        {planNote}
      </p>
    </div>
  );
}

/** Weight and volume against the vehicle limit: loaded (solid) and planned (tint). */
export function CapacityCard({ vehicleCode, planVersion, weight, volume, className }: CapacityCardProps) {
  return (
    <LoaderCard title="Capacity" description={`${vehicleCode} limits`} className={className}>
      <CapacityBar label="Weight" measure={weight} format={formatKg} formatValue={formatKgValue} planVersion={planVersion} />
      <CapacityBar label="Volume" measure={volume} format={formatM3} formatValue={formatM3Value} planVersion={planVersion} />
    </LoaderCard>
  );
}
