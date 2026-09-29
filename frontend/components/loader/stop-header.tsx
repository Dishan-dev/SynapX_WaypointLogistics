import { cn } from "cn";
import { formatStopDetails, loadOrderLabel } from "@/lib/loader/format";
import type { RunStop } from "@/lib/loader/types";

interface StopHeaderProps {
  stop: RunStop;
  /** Number of stops on the run, used for the "LOAD LAST · BY DOOR" label. */
  stopCount: number;
  className?: string;
}

/** Heading above a stop's orders: load position, stop and outlet, dock and ETA. */
export function StopHeader({ stop, stopCount, className }: StopHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-1 pt-1", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-primary px-2.5 py-[3px] text-xs leading-[17px] font-medium text-primary-foreground">
          {loadOrderLabel(stop.load_position, stopCount)}
        </span>
        <h2 className="text-base leading-[22px] font-semibold text-primary">
          Stop {stop.stop_sequence} · {stop.outlet.outlet_code}
          {stop.is_new && " · NEW STOP"}
        </h2>
      </div>
      <p className="text-xs leading-[17px] text-muted-foreground">{formatStopDetails(stop)}</p>
    </div>
  );
}
