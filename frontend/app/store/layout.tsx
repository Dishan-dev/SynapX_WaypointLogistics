import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { StoreSidebar } from "@/components/store/store-sidebar";
import { StoreTopBar } from "@/components/store/store-top-bar";
import { StoreMobileAppBar } from "@/components/store/store-mobile-app-bar";
import { StoreBottomNav } from "@/components/store/store-bottom-nav";
import { StoreOutletProvider } from "@/components/store/outlet-context";
import { getCurrentOutlet } from "@/components/store/api/store-data";

// Store pages read live data when NEXT_PUBLIC_STORE_DATA_SOURCE=api, so render them per request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store Manager | Waypoint Logistics",
};

export default async function StoreLayout({ children }: LayoutProps<"/store">) {
  // The shell still renders if the outlet can't load; pages that need it show their own error.
  const outlet = await getCurrentOutlet().catch(() => null);
  return (
    <StoreOutletProvider outlet={outlet}>
      {/* 15rem instead of Figma's 220px so "Incoming Deliveries" and "Exceptions & Issues" fit without truncating. */}
      <SidebarProvider style={{ "--sidebar-width": "15rem" } as CSSProperties}>
        <StoreSidebar />
        <SidebarInset className="min-w-0 bg-background">
          <StoreMobileAppBar />
          <StoreTopBar outlet={outlet} />
          {/* Bottom padding on mobile keeps content clear of the fixed bottom nav. */}
          <div className="flex-1 px-4 pt-4 pb-24 md:px-14 md:py-8">{children}</div>
          <StoreBottomNav />
          <Toaster position="top-center" />
        </SidebarInset>
      </SidebarProvider>
    </StoreOutletProvider>
  );
}
