"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SearchInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value"> {
  /** Visible label, e.g. "Loader name". */
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/**
 * Sign-in name search, 48px tall. Takes a 2px navy border once text is
 * entered (Figma Typing / Selected). Extra props (e.g. combobox ARIA) go to
 * the input.
 */
export function SearchInput({ label, value, onChange, className, id, ...props }: SearchInputProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const hasValue = value.length > 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={inputId} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-12 rounded-md bg-card pr-3.5 pl-11 text-[15px] md:text-[15px]",
            hasValue ? "border-2 border-primary font-medium" : "border-border",
          )}
          {...props}
        />
      </div>
    </div>
  );
}
