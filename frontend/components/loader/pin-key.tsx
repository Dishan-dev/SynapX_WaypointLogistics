"use client";

import * as React from "react";
import { Delete } from "lucide-react";
import { cn } from "cn";

interface PinKeyProps extends Omit<React.ComponentProps<"button">, "value" | "onClick" | "children"> {
  /** A digit, or "backspace" to delete the last digit. */
  value: string;
  onPress: (value: string) => void;
}

/** One key of the sign-in PIN pad (56px tall for gloved touch). */
export function PinKey({ value, onPress, className, ...props }: PinKeyProps) {
  const isBackspace = value === "backspace";
  return (
    <button
      type="button"
      aria-label={isBackspace ? "Delete last digit" : undefined}
      onClick={() => onPress(value)}
      className={cn(
        "flex h-14 w-full items-center justify-center rounded-lg border border-border bg-card text-2xl leading-[30px] font-bold text-primary outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {isBackspace ? <Delete className="size-6" aria-hidden /> : value}
    </button>
  );
}
