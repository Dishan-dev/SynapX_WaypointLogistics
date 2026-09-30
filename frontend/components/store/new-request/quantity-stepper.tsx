"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "cn";

// Figma quantity control: − value +, 44px touch targets. The value can also be typed.
export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 999,
  label,
  disabled,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Accessible name, e.g. "Quantity for Soft Drinks 1L (12pk)". */
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, Number.isFinite(next) ? next : min));
  const buttonClass =
    "flex size-11 shrink-0 items-center justify-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40";

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-12 w-fit items-center rounded-sm border border-input bg-card",
        disabled && "opacity-50",
        className
      )}
    >
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="Decrease"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => onChange(clamp(parseInt(event.target.value, 10)))}
        className="h-full w-12 [appearance:textfield] bg-transparent text-center text-base font-bold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="Increase"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
