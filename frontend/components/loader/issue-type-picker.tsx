import * as React from "react";
import { CircleMinus, CircleX, Package, TrendingDown } from "lucide-react";
import { cn } from "cn";
import type { IssueType } from "@/lib/loader/types";

const TYPES: { type: IssueType; label: string; icon: React.ReactNode }[] = [
  { type: "missing", label: "Missing", icon: <CircleMinus aria-hidden /> },
  { type: "short", label: "Short", icon: <TrendingDown aria-hidden /> },
  { type: "damaged", label: "Damaged", icon: <CircleX aria-hidden /> },
  { type: "wont_fit", label: "Won’t fit", icon: <Package aria-hidden /> },
];

/** Selected look per type (Figma 1d, 1d.1): a shortfall in red, won't fit in navy. */
const selected: Record<IssueType, string> = {
  missing: "border-destructive bg-destructive text-white",
  short: "border-destructive bg-destructive text-white",
  damaged: "border-destructive bg-destructive text-white",
  wont_fit: "border-primary bg-primary text-primary-foreground",
};

interface IssueTypePickerProps {
  value: IssueType | null;
  onChange: (type: IssueType) => void;
  className?: string;
}

/** Issue type on the flag sheet: Missing · Short · Damaged · Won't fit. */
export function IssueTypePicker({ value, onChange, className }: IssueTypePickerProps) {
  return (
    <div role="radiogroup" aria-label="Issue type" className={cn("grid grid-cols-2 gap-2 md:grid-cols-4", className)}>
      {TYPES.map(({ type, label, icon }) => {
        const active = value === type;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(type)}
            className={cn(
              "flex h-12 items-center justify-center gap-2 rounded-lg border text-[15px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&_svg]:size-[18px]",
              active ? selected[type] : "border-border bg-card text-foreground hover:bg-accent",
            )}
          >
            {icon}
            {label}
          </button>
        );
      })}
    </div>
  );
}
