import type { Metadata } from "next";
import { currentOutlet } from "@/components/store/mock-data";
import { storeNow } from "@/components/store/api/config";
import { NotificationsView } from "@/components/store/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Notifications | Waypoint Logistics",
};

// Figma: Desktop / 10 Notifications and Mobile / 10 Notifications.
export default function NotificationsPage() {
  return <NotificationsView outlet={currentOutlet} now={storeNow()} />;
}
