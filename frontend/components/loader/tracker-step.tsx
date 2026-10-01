import { Circle, CircleCheck } from "lucide-react";
import { cn } from "cn";

interface TrackerStepProps {
  state: "done" | "pending";
  /** Sent · Seen / Escalated · Decision / Default. */
  label: string;
  time?: string;
  className?: string;
}

/** One step of the flag tracker. Use inside an <ol>. */
export function TrackerStep({ state, label, time, className }: TrackerStepProps) {
  const done = state === "done";
  return (
    <li className={cn("flex flex-col items-center gap-1 text-center", className)}>
      {done ? (
        <CircleCheck className="size-[22px] text-success" aria-hidden />
      ) : (
        <Circle className="size-[22px] text-muted-foreground" aria-hidden />
      )}
      <span className={cn("text-sm font-semibold", done ? "text-foreground" : "text-muted-foreground")}>
        {label}
        <span className="sr-only">{done ? ", done" : ", pending"}</span>
      </span>
      {time && <span className="text-xs leading-[17px] text-muted-foreground">{time}</span>}
    </li>
  );
}
