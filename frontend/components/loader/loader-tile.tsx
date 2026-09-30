import * as React from "react";
import { cn } from "cn";

interface LoaderTileProps extends Omit<React.ComponentProps<"button">, "onSelect" | "children"> {
  initials: string;
  /** Short display name, e.g. "Saman J.". */
  name: string;
  selected: boolean;
  onSelect: () => void;
}

/** Recent-loader tile on the sign-in screen. */
export function LoaderTile({ initials, name, selected, onSelect, className, ...props }: LoaderTileProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-12 items-center gap-2 rounded-lg py-3 pr-2 pl-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        selected ? "border-2 border-primary bg-accent" : "border border-border bg-card hover:bg-accent",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          selected ? "bg-primary text-primary-foreground" : "bg-accent text-primary",
        )}
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{name}</span>
    </button>
  );
}
