import * as React from "react";
import { cn } from "cn";

interface MetricTileProps {
  label: string;
  value: React.ReactNode;
  caption?: string;
  className?: string;
}

/**
 * Loader metric (Runs, Loading, Issues, Ready). The shared domain MetricCard
 * uses a different layout, so the loader keeps its own tile.
 */
export function MetricTile({ label, value, caption, className }: MetricTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-[28px] leading-[34px] font-bold text-primary">{value}</span>
      {caption && <span className="text-xs leading-[17px] text-muted-foreground">{caption}</span>}
    </div>
  );
}
