import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "cn";

interface UnitStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Under the count, e.g. "units damaged". */
  unitLabel: string;
  className?: string;
}

const stepButton =
  "flex size-13 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 disabled:hover:bg-card";

/** Units affected on the flag sheet: − "3 of 56 units damaged" + (Figma 1d). */
export function UnitStepper({ value, min, max, onChange, unitLabel, className }: UnitStepperProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <button
        type="button"
        aria-label="One fewer unit"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={stepButton}
      >
        <Minus className="size-6" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 flex-col items-center" aria-live="polite">
        <span className="text-[28px] leading-[34px] font-bold text-primary">
          {value} of {max}
        </span>
        <span className="text-xs text-muted-foreground">{unitLabel}</span>
      </div>
      <button
        type="button"
        aria-label="One more unit"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={stepButton}
      >
        <Plus className="size-6" aria-hidden />
      </button>
    </div>
  );
}
