import * as React from "react";
import { cn } from "cn";
import { Badge } from "@/components/ui/badge";

export type LoaderPillTone = "primary" | "info" | "success" | "warning" | "error" | "neutral";

const toneClasses: Record<LoaderPillTone, string> = {
  primary: "bg-accent text-primary",
  info: "bg-info-muted text-info-muted-foreground",
  success: "bg-success-muted text-success-muted-foreground",
  warning: "bg-warning-muted text-warning-muted-foreground",
  error: "bg-destructive-muted text-destructive-muted-foreground",
  neutral: "bg-background text-muted-foreground",
};

interface LoaderPillProps extends React.ComponentProps<"span"> {
  tone?: LoaderPillTone;
  /** Optional leading icon, rendered at 14px. */
  icon?: React.ReactNode;
}

/** Status pill from the Figma loader component set (Semi Bold 13). */
export function LoaderPill({
  tone = "neutral",
  icon,
  className,
  children,
  ...props
}: LoaderPillProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto gap-1 border-border px-2.5 py-1.5 text-[13px] leading-[17px] font-semibold [&>svg]:size-3.5!",
        icon && "pl-2",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </Badge>
  );
}
