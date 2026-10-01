"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarDays, ChevronDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function rangeLabel(range: DateRange | undefined) {
  if (!range?.from) return "All dates";
  if (!range.to || range.to.getTime() === range.from.getTime()) return format(range.from, "d MMM yyyy");
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  return `${format(range.from, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}`;
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Request date: ${rangeLabel(value)}`}
          className={cn(
            "h-11 justify-between gap-2 border-input bg-card px-3 text-base font-normal text-foreground hover:bg-card",
            !value?.from && "text-muted-foreground",
            className
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarDays className="hidden size-5 shrink-0 sm:block" aria-hidden="true" />
            <span className="truncate">{rangeLabel(value)}</span>
          </span>
          <ChevronDown className="size-5 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="range" selected={value} onSelect={onChange} numberOfMonths={1} autoFocus />
        <div className="flex justify-end gap-2 border-t border-border p-2">
          <Button
            variant="ghost"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
          >
            Clear
          </Button>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
