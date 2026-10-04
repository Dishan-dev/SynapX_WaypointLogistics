import { Check } from "lucide-react";
import { cn } from "cn";
import { formatM3, type LoadMapSlot, type LoadMapSlotState } from "@/lib/loader/format";

// Tablet rail: segment height follows volume (Figma draws ~13.6px per m³).
const PX_PER_M3 = 13.6;
const MIN_SEGMENT_PX = 36;

const slotClasses: Record<LoadMapSlotState, string> = {
  loaded: "bg-primary text-primary-foreground",
  loading: "bg-primary/45 text-primary-foreground",
  new: "border border-info bg-info-muted text-info-muted-foreground",
  pending: "border border-border bg-card text-foreground",
};

const stateSuffix: Record<LoadMapSlotState, string> = {
  loaded: "",
  loading: " · loading",
  new: " · NEW",
  pending: "",
};

const spareClasses = "border border-dashed border-muted-foreground/40 bg-background text-muted-foreground";

function slotDescription(slot: LoadMapSlot): string {
  const state = { loaded: "loaded", loading: "loading", new: "new stop", pending: "not loaded" }[slot.state];
  return `Stop ${slot.stopSequence}, ${slot.outletCode}, ${formatM3(slot.volumeM3)}, ${state}`;
}

interface LoadMapProps {
  /** Slots cab to door (load order). */
  slots: LoadMapSlot[];
  spareM3: number;
  /** vertical: tablet context rail · horizontal: mobile strip. */
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/** Cab-to-door view of the vehicle, as seen from the dock. */
export function LoadMap({ slots, spareM3, orientation = "vertical", className }: LoadMapProps) {
  const endLabel = "text-xs leading-[17px] font-medium text-muted-foreground";

  if (orientation === "horizontal") {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className={cn("flex justify-between", endLabel)} aria-hidden>
          <span>CAB · deepest</span>
          <span>DOOR</span>
        </div>
        <ol className="flex h-10 gap-0.5" aria-label="Load map, cab to door">
          {slots.map((slot) => (
            <li
              key={slot.stopSequence}
              aria-label={slotDescription(slot)}
              className={cn(
                "flex min-w-8 items-center justify-center rounded-md text-xs leading-[17px] font-medium",
                slotClasses[slot.state],
              )}
              style={{ flexGrow: slot.volumeM3, flexBasis: 0 }}
            >
              S{slot.stopSequence}
            </li>
          ))}
          {spareM3 > 0 && (
            <li
              aria-label={`Spare ${formatM3(spareM3)}`}
              className={cn("min-w-4 rounded-md", spareClasses)}
              style={{ flexGrow: spareM3, flexBasis: 0 }}
            />
          )}
        </ol>
      </div>
    );
  }

  const height = (m3: number) => Math.max(MIN_SEGMENT_PX, Math.round(m3 * PX_PER_M3));

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className={endLabel} aria-hidden>
        CAB · deepest
      </span>
      <ol className="flex flex-col gap-0.5" aria-label="Load map, cab to door">
        {slots.map((slot) => (
          <li
            key={slot.stopSequence}
            aria-label={slotDescription(slot)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 text-xs leading-[17px] font-medium",
              slotClasses[slot.state],
            )}
            style={{ height: height(slot.volumeM3) }}
          >
            {slot.state === "loaded" && <Check className="size-4 shrink-0" aria-hidden />}
            <span className="min-w-0 flex-1 truncate">
              {slot.stopSequence} · {slot.outletCode}
              {stateSuffix[slot.state]}
            </span>
          </li>
        ))}
        {spareM3 > 0 && (
          <li
            className={cn("flex items-center rounded-md px-3 text-xs leading-[17px] font-medium", spareClasses)}
            style={{ height: height(spareM3) }}
          >
            spare {formatM3(spareM3)}
          </li>
        )}
      </ol>
      <span className={endLabel} aria-hidden>
        DOOR
      </span>
    </div>
  );
}
