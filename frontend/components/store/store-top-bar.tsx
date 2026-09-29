import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  brandLabels,
  currentManager,
  currentOutlet,
  unreadNotificationCount,
} from "@/components/store/mock-data";

// Desktop top bar (Figma: Components / Top Bar). Hidden on mobile, where StoreMobileAppBar takes over.
export function StoreTopBar() {
  return (
    <header className="hidden shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-6 py-4 md:flex lg:gap-6 lg:px-10">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <p className="truncate text-sm font-bold text-foreground">
          {currentOutlet.code} — {brandLabels[currentOutlet.brand]} · {currentOutlet.district}
        </p>
        <span className="hidden shrink-0 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground xl:inline">
          Delivery window · {currentOutlet.windowStart} – {currentOutlet.windowEnd}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div role="search" className="relative w-52 lg:w-72">
          <Label htmlFor="store-search" className="sr-only">
            Search orders and deliveries
          </Label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="store-search"
            type="search"
            placeholder="Search orders, deliveries…"
            className="h-11 pl-10"
          />
        </div>

        <Button asChild variant="ghost" size="icon-lg" className="relative text-foreground">
          <Link
            href="/store/notifications"
            aria-label={`Notifications, ${unreadNotificationCount} unread`}
          >
            <Bell className="size-6" aria-hidden="true" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-destructive" />
            )}
          </Link>
        </Button>

        <span
          className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground"
          title={currentManager.fullName}
        >
          <span aria-hidden="true">{currentManager.initials}</span>
          <span className="sr-only">Signed in as {currentManager.fullName}</span>
        </span>
      </div>
    </header>
  );
}
