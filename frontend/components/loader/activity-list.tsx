import * as React from "react";
import { cn } from "cn";
import type { ActivityRow } from "@/lib/loader/format";

interface ActivityListProps {
  rows: ActivityRow[];
  className?: string;
}

/**
 * Log rows as the Change log card draws them (Figma T1c): the time in bold on
 * the left, a short sentence on the right. No icons, no grouping.
 */
export function ActivityList({ rows, className }: ActivityListProps) {
  return (
    <ol className={cn("flex flex-col gap-2", className)}>
      {rows.map((row) => (
        <li key={row.key} className="flex gap-2.5 text-xs leading-[17px]">
          <time dateTime={row.at} className="w-9 shrink-0 font-semibold text-primary tabular-nums">
            {row.time}
          </time>
          <span className="min-w-0 text-muted-foreground">{row.summary}</span>
        </li>
      ))}
    </ol>
  );
}
