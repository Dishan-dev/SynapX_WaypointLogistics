"use client";

import React from "react";
import Link from "next/link";
import { Building2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function StoreManagerDashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/">
              <ArrowLeft className="size-4" />
              <span>Back to Portal</span>
            </Link>
          </Button>
          <Badge variant="outline" className="text-accent border-accent/30 bg-accent/5">
            Role: Store Manager &amp; Client
          </Badge>
        </div>

        <div className="border-b border-border pb-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <Building2 className="size-6 text-primary" />
              <span>Store Replenishment &amp; Inbound Receipt</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Store #42 (Central Retail Hub) &bull; Delivery scheduling and delivery confirmation.
            </p>
          </div>
          <Button size="sm" className="bg-primary text-primary-foreground">
            + New Order Request
          </Button>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Incoming Deliveries</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Shipments dispatched to this store location
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3.5 rounded-lg border border-accent/30 bg-accent/5 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold text-foreground">Order #ORD-9921 &bull; 42 Cartons</div>
                <div className="text-muted-foreground mt-0.5">Assigned to Trip #TRK-104 (Driver: Marcus Vance)</div>
                <div className="text-accent font-medium mt-1">Expected: Today at 10:45 AM</div>
              </div>
              <Button size="xs" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Confirm Receipt
              </Button>
            </div>

            <div className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-semibold text-foreground">Order #ORD-9918 &bull; 18 Cartons</div>
                <div className="text-muted-foreground mt-0.5">Scheduled from North Chilled Depot</div>
                <div className="text-muted-foreground mt-1">Expected: Today at 14:30 PM</div>
              </div>
              <Badge variant="outline" className="border-border">Scheduled</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
