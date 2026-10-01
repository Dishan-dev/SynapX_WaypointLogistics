"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useUnreadCount } from "@/components/store/notifications/notification-store";

/** Bell link with an unread dot. `tone="inverse"` is for the dark mobile app bar. */
export function NotificationBell({ tone = "default" }: { tone?: "default" | "inverse" }) {
  const unread = useUnreadCount();
  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        "relative",
        tone === "inverse"
          ? "size-11 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          : "size-9 text-foreground"
      )}
    >
      <Link href="/store/notifications" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}>
        <Bell className="size-6" aria-hidden="true" />
        {unread > 0 && (
          <span
            className={cn(
              "absolute size-2 rounded-full bg-destructive",
              tone === "inverse" ? "top-2 right-2.5" : "top-1.5 right-1.5"
            )}
          />
        )}
      </Link>
    </Button>
  );
}

/** "4 unread" text that stays in sync with the read state (Mobile / 12 More). */
export function UnreadCountText() {
  const unread = useUnreadCount();
  return <>{unread === 0 ? "All caught up" : `${unread} unread`}</>;
}
