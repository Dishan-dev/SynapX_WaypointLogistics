import { Package, Snowflake } from "lucide-react";
import type { TemperatureClass } from "@/lib/loader/types";
import { LoaderPill } from "./loader-pill";

interface TempBadgeProps {
  temp: TemperatureClass;
  className?: string;
}

/** Chilled / Ambient badge. Always icon + text so it never relies on colour. */
export function TempBadge({ temp, className }: TempBadgeProps) {
  return temp === "chilled" ? (
    <LoaderPill tone="info" icon={<Snowflake aria-hidden />} className={className}>
      Chilled
    </LoaderPill>
  ) : (
    <LoaderPill tone="neutral" icon={<Package aria-hidden />} className={className}>
      Ambient
    </LoaderPill>
  );
}
