import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { currentOutlet, unreadNotificationCount } from "@/components/store/mock-data";

// Mobile "More" tab (Figma: Mobile / 12 More): pages that don't fit in the bottom nav.
const moreLinks = [
  {
    title: "Shortfalls & Back-orders",
    description: "Items not sent or received in full",
    href: "/store/requests?tab=shortfalls",
  },
  {
    title: "Delivery History",
    description: "Completed deliveries",
    href: "/store/history",
  },
  {
    title: "Outlet Settings",
    description: `${currentOutlet.code} details and delivery setup`,
    href: "/store/settings",
  },
  {
    title: "Notifications",
    description: `${unreadNotificationCount} unread`,
    href: "/store/notifications",
  },
];

export default function StoreMorePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">More</h1>
      <Card className="gap-0 py-0">
        <ul className="divide-y divide-border">
          {moreLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-base font-semibold text-foreground">{link.title}</span>
                  <span className="text-sm text-muted-foreground">{link.description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {/* TODO(keycloak): the login team replaces this with the real Keycloak sign-out. */}
      <Link
        href="/"
        className="flex min-h-11 w-fit items-center text-sm font-semibold text-destructive underline-offset-4 hover:underline"
      >
        Sign out
      </Link>
    </div>
  );
}
