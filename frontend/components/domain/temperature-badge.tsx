import * as React from "react";
import { Thermometer } from "lucide-react";
import { cn } from "cn";

interface TemperatureBadgeProps {
  temperature: number; // in Celsius
  targetRange?: string; // e.g., "+2°C to +8°C"
  className?: string;
}

export function TemperatureBadge({
  temperature,
  targetRange = "+2°C to +8°C",
  className,
}: TemperatureBadgeProps) {
  // Cold-chain compliance check
  const isCompliant = temperature >= 2 && temperature <= 8;
  const isFreezing = temperature < 2;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-medium border",
        isCompliant
          ? "border-accent/40 bg-accent/10 text-accent"
          : isFreezing
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-warning/40 bg-warning/10 text-warning-foreground",
        className
      )}
      title={`Target Range: ${targetRange}`}
    >
      <Thermometer className="size-3 shrink-0" />
      <span>{temperature > 0 ? `+${temperature}` : temperature}&deg;C</span>
      <span className="text-[10px] opacity-75 font-sans">
        {isCompliant ? "Compliant" : "Excursion"}
      </span>
    </span>
  );
}
