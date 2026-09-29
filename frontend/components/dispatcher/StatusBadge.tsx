import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "cn";

export type StatusVariant = "success" | "warning" | "destructive" | "info" | "neutral" | "primary";

interface StatusBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  status: string;
  variant?: StatusVariant;
}

export function StatusBadge({ status, variant = "neutral", className, ...props }: StatusBadgeProps) {
  const variantStyles = {
    success: "bg-success-muted text-success-muted-foreground hover:bg-success-muted/80",
    warning: "bg-warning-muted text-warning-muted-foreground hover:bg-warning-muted/80",
    destructive: "bg-destructive-muted text-destructive-muted-foreground hover:bg-destructive-muted/80",
    info: "bg-info-muted text-info-muted-foreground hover:bg-info-muted/80",
    neutral: "bg-muted text-muted-foreground hover:bg-muted/80",
    primary: "bg-primary text-primary-foreground hover:bg-primary/80",
  };

  return (
    <Badge 
      variant="outline" 
      className={cn("border-none font-medium px-2.5 py-0.5", variantStyles[variant], className)}
      {...props}
    >
      {status}
    </Badge>
  );
}
