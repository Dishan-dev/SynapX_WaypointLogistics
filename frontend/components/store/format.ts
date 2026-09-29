import { differenceInCalendarDays, format, parseISO } from "date-fns";
import type { StoreOutlet } from "@/components/store/mock-data";

const windowLabel = (outlet: StoreOutlet) => `${outlet.windowStart} – ${outlet.windowEnd}`;

/** "Today, 04:00 – 07:45" / "Tomorrow, …" / "Mon 28 Sep, …" — for upcoming deliveries. */
export function formatRelativeWindow(orderDate: string, outlet: StoreOutlet, now: Date) {
  const date = parseISO(orderDate);
  const days = differenceInCalendarDays(date, now);
  const day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : format(date, "EEE d MMM");
  return `${day}, ${windowLabel(outlet)}`;
}

/** "26 Sep, 04:00 – 07:45" — for request lists. */
export function formatShortWindow(orderDate: string, outlet: StoreOutlet) {
  return `${format(parseISO(orderDate), "d MMM")}, ${windowLabel(outlet)}`;
}

/** "06:10" */
export function formatTime(isoDateTime: string) {
  return format(parseISO(isoDateTime), "HH:mm");
}

export function formatItemCount(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

export function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
