import type { Metadata } from "next";
import { currentOutlet, MOCK_NOW } from "@/components/store/mock-data";
import { NotificationsView } from "@/components/store/notifications/notifications-view";

export const metadata: Metadata = {
  title: "Notifications | Waypoint Logistics",
};

// Figma: Desktop / 10 Notifications and Mobile / 10 Notifications.
export default function NotificationsPage() {
  return <NotificationsView outlet={currentOutlet} now={MOCK_NOW} />;
}
