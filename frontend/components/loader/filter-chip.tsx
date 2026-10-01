import * as React from "react";
import { cn } from "cn";

interface FilterChipProps extends Omit<React.ComponentProps<"button">, "children"> {
  label: string;
  /** Runs in this group, shown in the count badge. */
  count?: number;
  active: boolean;
}

/**
 * Queue filter. Drawn 40px tall as in Figma; the hit area extends to 48px
 * for gloved touch.
 */
export function FilterChip({ label, count, active, className, ...props }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "relative inline-flex h-10 items-center gap-[5px] rounded-md border px-2.5 text-[13px] whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "after:absolute after:-inset-y-1 after:inset-x-0",
        active
          ? "border-primary bg-primary font-semibold text-primary-foreground"
          : "border-border bg-card font-medium text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    >
      {label}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-px text-xs font-semibold",
            active ? "bg-primary-foreground/15 text-primary-foreground" : "bg-background text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
