import * as React from "react";
import { cn } from "cn";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  Truck,
  WifiOff,
  RefreshCw,
} from "lucide-react";

export type StatusType =
  | "synchronized"
  | "on-time"
  | "in-transit"
  | "warning"
  | "delayed"
  | "critical"
  | "offline"
  | "syncing"
  | "deferred";

interface StatusPillProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusPill({ status, label, className }: StatusPillProps) {
  switch (status) {
    case "synchronized":
    case "on-time":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-accent/30 bg-accent/10 text-accent",
            className
          )}
        >
          <CheckCircle2 className="size-3" />
          <span>{label || (status === "synchronized" ? "Synchronized" : "On Time")}</span>
        </span>
      );
    case "in-transit":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-primary/20 bg-primary/5 text-primary",
            className
          )}
        >
          <Truck className="size-3" />
          <span>{label || "In Transit"}</span>
        </span>
      );
    case "warning":
    case "delayed":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-warning/40 bg-warning/10 text-warning-foreground",
            className
          )}
        >
          <Clock className="size-3 text-warning" />
          <span>{label || (status === "delayed" ? "Delayed" : "Capacity Risk")}</span>
        </span>
      );
    case "critical":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-destructive/30 bg-destructive/10 text-destructive",
            className
          )}
        >
          <AlertCircle className="size-3" />
          <span>{label || "Critical Exception"}</span>
        </span>
      );
    case "offline":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-border bg-muted text-muted-foreground",
            className
          )}
        >
          <WifiOff className="size-3" />
          <span>{label || "Offline"}</span>
        </span>
      );
    case "syncing":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-accent/40 bg-accent/10 text-accent animate-pulse",
            className
          )}
        >
          <RefreshCw className="size-3 animate-spin" />
          <span>{label || "Syncing"}</span>
        </span>
      );
    case "deferred":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-warning/30 bg-warning/5 text-muted-foreground",
            className
          )}
        >
          <AlertTriangle className="size-3 text-warning" />
          <span>{label || "Deferred"}</span>
        </span>
      );
    default:
      return null;
  }
}
