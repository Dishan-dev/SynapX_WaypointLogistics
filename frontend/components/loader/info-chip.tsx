import * as React from "react";
import { cn } from "cn";

export type InfoChipTone = "neutral" | "info" | "primary" | "warning";

const toneClasses: Record<InfoChipTone, string> = {
  neutral: "bg-background text-muted-foreground",
  info: "bg-info-muted text-info-muted-foreground",
  primary: "bg-accent text-primary",
  warning: "bg-warning-muted text-warning-muted-foreground",
};

interface InfoChipProps extends React.ComponentProps<"span"> {
  /** Neutral: vehicle/type/info · Info: reefer · Primary: date · Warning: access limit or festival. */
  tone?: InfoChipTone;
  /** Optional leading icon, rendered at 14px. */
  icon?: React.ReactNode;
}

/** Attribute chip (vehicle type, capacity, window, date). Not a status: use LoaderPill. */
export function InfoChip({ tone = "neutral", icon, className, children, ...props }: InfoChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap [&>svg]:size-3.5 [&>svg]:shrink-0",
        icon && "pl-2",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
