import * as React from "react";
import { cn } from "cn";

interface SuggestionRowProps extends Omit<React.ComponentProps<"button">, "onSelect" | "children"> {
  initials: string;
  name: string;
  /** Second line, e.g. "Loader · Peliyagoda DC". */
  detail: string;
  /** Best match: Enter selects it. */
  highlighted: boolean;
  onSelect: () => void;
}

/** Search result row on sign-in (56px tap target). */
export function SuggestionRow({
  initials,
  name,
  detail,
  highlighted,
  onSelect,
  className,
  ...props
}: SuggestionRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-highlighted={highlighted || undefined}
      className={cn(
        "flex h-14 w-full items-center gap-3 px-3 text-left outline-none hover:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
        highlighted ? "bg-background" : "bg-card",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
          highlighted ? "bg-primary text-primary-foreground" : "bg-background text-primary",
        )}
      >
        {initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}
