"use client";

import React from "react";
import Link from "next/link";
import { Navigation, ArrowLeft, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DriverDashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/">
              <ArrowLeft className="size-4" />
              <span>Back to Portal</span>
            </Link>
          </Button>
          <Badge variant="outline" className="text-accent border-accent/30 bg-accent/5">
            Role: Driver Mobile View
          </Badge>
        </div>

        <div className="border-b border-border pb-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Navigation className="size-6 text-primary" />
            <span>Driver Trip Console</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Safe-when-stopped mobile route guidance and digital proof-of-delivery.
          </p>
        </div>

        <Card className="border-border">
          <CardHeader className="pb-3 border-b border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-muted-foreground">ACTIVE ASSIGNMENT</span>
              <Badge className="bg-primary text-primary-foreground">En Route</Badge>
            </div>
            <CardTitle className="text-lg font-bold">Trip #TRK-104 &bull; Drop 6 of 8</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Vehicle: Isuzu NPR (Plate: #WP-8812)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-xs">
            <div className="p-3.5 rounded-lg bg-muted/40 border border-border space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <MapPin className="size-4 text-primary shrink-0" />
                <span>Waypoint Express Retail #42</span>
              </div>
              <div className="text-muted-foreground pl-6">
                78 Orchard Boulevard, Singapore 238872
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <span className="text-muted-foreground">Estimated Arrival:</span>
                <span className="font-bold text-foreground">10:45 AM (8 mins)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button size="lg" className="h-12 bg-primary text-primary-foreground font-semibold text-xs">
                <Navigation className="size-4 mr-2" />
                Open GPS
              </Button>
              <Button size="lg" variant="outline" className="h-12 border-accent text-accent hover:bg-accent/10 font-semibold text-xs">
                <CheckCircle2 className="size-4 mr-2" />
                Confirm POD
              </Button>
            </div>

            <div className="text-center text-[11px] text-muted-foreground pt-1">
              Offline mode enabled. Proof of Delivery automatically syncs when network reconnects.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
