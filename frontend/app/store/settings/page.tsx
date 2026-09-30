"use client";

import React from "react";
import { SlidersVertical, Building2, Clock, Phone, MapPin } from "lucide-react";
import { currentOutlet, currentManager } from "@/components/store/mock-data";

export default function OutletSettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Outlet Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Store parameters, delivery window configurations, and contact information.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Building2 className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-foreground">{currentOutlet.name}</h3>
            <p className="text-xs text-muted-foreground">Outlet Code: {currentOutlet.code}</p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Operating Brand</span>
            <span className="font-bold capitalize text-foreground">{currentOutlet.brand}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">District Region</span>
            <span className="font-bold text-foreground">{currentOutlet.district}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border/50">
            <span className="text-muted-foreground">Standard Delivery Window</span>
            <span className="font-bold text-foreground">{currentOutlet.windowStart} – {currentOutlet.windowEnd}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-muted-foreground">Store Manager</span>
            <span className="font-bold text-foreground">{currentManager.fullName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
