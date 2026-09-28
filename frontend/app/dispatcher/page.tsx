"use client";

import React from "react";
import Link from "next/link";
import { Truck, ArrowLeft, Layers, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DispatcherDashboard() {
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
            Role: Dispatcher
          </Badge>
        </div>

        <div className="border-b border-border pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Truck className="size-6 text-primary" />
            <span>Dispatcher Operational Dashboard</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fleet allocation, multi-stop manifest planning, and active trip monitoring.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <span>Active Manifests</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Trips currently on road</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">148</div>
              <div className="text-xs text-muted-foreground mt-1">140 on-time • 8 queued</div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="size-4 text-accent" />
                <span>Staging Bay Utilization</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Distribution Center 1</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">84.6%</div>
              <div className="text-xs text-muted-foreground mt-1">6 of 8 bays active</div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="size-4 text-accent" />
                <span>On-Time SLA</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Rolling 24 Hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">99.2%</div>
              <div className="text-xs text-muted-foreground mt-1">Target: 98.5%</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Active Fleet Manifest Schedule</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Planned delivery routes and driver assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
              <div>
                <span className="font-mono font-semibold text-foreground">Trip #TRK-104</span> &bull; Marcus Vance (Isuzu NPR)
                <div className="text-muted-foreground mt-0.5">Route: Central Hub &rarr; North Terminal (5 / 8 Completed)</div>
              </div>
              <Badge className="bg-primary text-primary-foreground">In Transit</Badge>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
              <div>
                <span className="font-mono font-semibold text-foreground">Trip #TRK-105</span> &bull; Elena Rostova (Hino 300)
                <div className="text-muted-foreground mt-0.5">Route: Central Hub &rarr; West Retail (8 / 8 Completed)</div>
              </div>
              <Badge variant="outline" className="border-accent text-accent">Completed</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
