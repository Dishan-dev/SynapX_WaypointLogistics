import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "cn";

interface MetricCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  subtext,
  badge,
  icon,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("border border-border shadow-xs", className)}>
      <CardContent className="p-4 flex flex-col justify-between h-full gap-2">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span className="truncate">{label}</span>
          {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-2xl font-bold tracking-tight text-foreground font-sans">
            {value}
          </div>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {subtext && (
          <div className="text-xs text-muted-foreground truncate border-t border-border/50 pt-2 mt-1">
            {subtext}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
