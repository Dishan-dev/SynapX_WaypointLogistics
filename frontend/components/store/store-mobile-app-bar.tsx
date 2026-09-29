"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { getStorePageTitle } from "@/components/store/store-nav";
import { currentOutlet, unreadNotificationCount } from "@/components/store/mock-data";

// Mobile app bar (Figma: Components / Mobile App Bar). Hidden from md up.
export function StoreMobileAppBar() {
  const pathname = usePathname();
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between bg-primary px-2 text-primary-foreground md:hidden">
      <Button
        variant="ghost"
        className="size-11 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        onClick={toggleSidebar}
        aria-label="Open navigation menu"
      >
        <Menu className="size-6" aria-hidden="true" />
      </Button>

      <div className="flex min-w-0 flex-col items-center">
        <p className="truncate text-base font-bold">{getStorePageTitle(pathname)}</p>
        <p className="truncate text-sm font-medium text-primary-foreground/70">
          {currentOutlet.code} · {currentOutlet.name}
        </p>
      </div>

      <Button
        asChild
        variant="ghost"
        className="relative size-11 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        <Link
          href="/store/notifications"
          aria-label={`Notifications, ${unreadNotificationCount} unread`}
        >
          <Bell className="size-6" aria-hidden="true" />
          {unreadNotificationCount > 0 && (
            <span className="absolute top-2 right-2.5 size-2 rounded-full bg-destructive" />
          )}
        </Link>
      </Button>
    </header>
  );
}
