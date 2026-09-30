import { cn } from "cn";
import { LoaderPill } from "./loader-pill";

interface DecisionOptionProps {
  title: string;
  description: string;
  /** The option the Dispatcher chose (or the default that was applied). */
  chosen: boolean;
  className?: string;
}

/**
 * A Dispatcher decision option shown to the loader. Read-only: the loader
 * sees which option was chosen but does not pick one. Use inside a <ul>.
 */
export function DecisionOption({ title, description, chosen, className }: DecisionOptionProps) {
  return (
    <li
      aria-current={chosen || undefined}
      className={cn(
        "flex items-start gap-3 rounded-lg p-3.5",
        chosen ? "border-2 border-primary bg-accent" : "border border-border bg-card",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          chosen ? "border-primary" : "border-muted-foreground/40",
        )}
      >
        {chosen && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          {chosen && <LoaderPill tone="primary">Chosen</LoaderPill>}
        </div>
        <p className="text-xs leading-[17px] text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}
