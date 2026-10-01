import * as React from "react";
import Link from "next/link";
import { cn } from "cn";

export type AlertRowTone = "error" | "warning" | "neutral" | "success" | "info";

const toneClasses: Record<AlertRowTone, string> = {
  error: "border-destructive bg-destructive-muted text-destructive-muted-foreground",
  warning: "border-warning bg-warning-muted text-warning-muted-foreground",
  neutral: "border-border bg-background text-foreground",
  success: "border-border bg-success-muted text-success-muted-foreground",
  info: "border-border bg-info-muted text-info-muted-foreground",
};

interface AlertRowProps {
  tone: AlertRowTone;
  message: React.ReactNode;
  /** Optional leading icon, rendered at 16px. */
  icon?: React.ReactNode;
  actionLabel?: string;
  /** Navigates when set; otherwise onAction is called. */
  actionHref?: string;
  onAction?: () => void;
  className?: string;
}

/** One-line alert inside a card (run card alert, plan update, flag status). */
export function AlertRow({
  tone,
  message,
  icon,
  actionLabel,
  actionHref,
  onAction,
  className,
}: AlertRowProps) {
  const actionClass =
    "-my-px -mr-1.5 flex min-h-12 shrink-0 items-center rounded-md px-1.5 text-sm font-semibold whitespace-nowrap text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

  return (
    <div
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-lg border px-3.5 [&>svg]:size-4 [&>svg]:shrink-0",
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      <p className="min-w-0 flex-1 py-3 text-sm font-semibold">{message}</p>
      {actionLabel &&
        (actionHref ? (
          <Link href={actionHref} className={actionClass}>
            {actionLabel}
          </Link>
        ) : (
          <button type="button" onClick={onAction} className={actionClass}>
            {actionLabel}
          </button>
        ))}
    </div>
  );
}
