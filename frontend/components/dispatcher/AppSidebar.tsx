"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  FileText, 
  Map, 
  Truck, 
  MapPin, 
  AlertCircle, 
  CarFront, 
  Store, 
  LineChart, 
  PieChart, 
  Command
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";

const navItems = [
  { name: "Dashboard", href: "/dispatcher", icon: LayoutDashboard },
  { name: "Orders", href: "/dispatcher/orders", icon: FileText },
  { name: "Allocations", href: "/dispatcher/allocations", icon: Map },
  { name: "Delivery Runs", href: "/dispatcher/delivery-runs", icon: Truck },
  { name: "Live Tracking", href: "/dispatcher/live-tracking", icon: MapPin },
  { name: "Exceptions", href: "/dispatcher/exceptions", icon: AlertCircle },
  { name: "Fleet", href: "/dispatcher/fleet", icon: CarFront },
  { name: "Outlets", href: "/dispatcher/outlets", icon: Store },
  { name: "Forecasts", href: "/dispatcher/forecasts", icon: LineChart },
  { name: "Analytics", href: "/dispatcher/analytics", icon: PieChart },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="p-4 flex items-center justify-start flex-row h-16 border-b border-sidebar-border">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Command className="size-4" />
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight ml-3">
          <span className="truncate font-semibold text-sidebar-foreground">WAYPOINT</span>
          <span className="truncate text-xs text-sidebar-foreground/70">Dispatch Portal</span>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2 pt-4">
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton 
                  asChild 
                  isActive={isActive} 
                  tooltip={item.name}
                  className="font-medium text-[13px] h-9"
                >
                  <Link href={item.href}>
                    <item.icon className="size-4" />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {/* Placeholder for Account Footer */}
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-semibold text-xs border border-border">
            KP
          </div>
          <div className="flex flex-col flex-1 overflow-hidden">
            <span className="text-sm font-medium text-sidebar-foreground truncate">Kasun Perera</span>
            <span className="text-xs text-sidebar-foreground/70 truncate">Peliyagoda DC</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
