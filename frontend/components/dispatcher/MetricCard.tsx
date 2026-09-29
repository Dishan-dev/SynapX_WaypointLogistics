import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

interface MetricCardProps {
  title: string;
  value: string | number;
  className?: string;
}

export function MetricCard({ title, value, className }: MetricCardProps) {
  return (
    <Card className={cn("border-border shadow-none rounded-lg", className)}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}
