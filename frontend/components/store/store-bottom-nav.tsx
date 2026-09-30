"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import {
  isStoreNavActive,
  storeBottomNavItems,
  storeMoreHrefs,
} from "@/components/store/store-nav";

// Mobile bottom navigation (Figma: Components / Mobile Bottom Nav). Hidden from md up.
export function StoreBottomNav() {
  const pathname = usePathname();

  const isTabActive = (href: string) => {
    if (href === "/store/more") {
      return storeMoreHrefs.some((moreHref) => isStoreNavActive(pathname, moreHref));
    }
    return isStoreNavActive(pathname, href);
  };

  return (
    <nav
      aria-label="Store Manager"
      className="fixed inset-x-0 bottom-0 z-20 flex h-16 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {storeBottomNavItems.map((item) => {
        const isActive = isTabActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              isActive ? "font-medium text-primary" : "text-muted-foreground"
            )}
          >
            <item.icon className="size-6" aria-hidden="true" />
            <span className="truncate">{item.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
