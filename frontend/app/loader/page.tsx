"use client";

import React from "react";
import Link from "next/link";
import { ScanBarcode, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function LoaderDashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/">
              <ArrowLeft className="size-4" />
              <span>Back to Operations Portal</span>
            </Link>
          </Button>
          <Badge variant="outline" className="text-accent border-accent/40 bg-accent/5 font-medium">
            Role: Loader
          </Badge>
        </div>

        <div className="border-b border-border pb-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <ScanBarcode className="size-6 text-accent" />
              <span>Loader Staging &amp; Manifest Verification</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Loading bay sequence verification, barcode scanning, and reverse-drop order verification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary text-primary-foreground font-mono">Bay 3 Active</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase font-semibold text-muted-foreground">Staging Target</CardTitle>
              <div className="text-xl font-bold text-foreground">Trip #TRK-104</div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Driver: Marcus Vance &bull; 8 Drops Total
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase font-semibold text-muted-foreground">Pallets Scanned</CardTitle>
              <div className="text-xl font-bold text-accent">5 of 8 Verified</div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              Reverse drop sequence enforced
            </CardContent>
          </Card>

          <Card className="border-border shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase font-semibold text-muted-foreground">Discrepancy Status</CardTitle>
              <div className="text-xl font-bold text-foreground">0 Shortfalls</div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              All carton counts tally with manifest
            </CardContent>
          </Card>
        </div>

        <Card className="border-border shadow-xs">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-sm font-semibold">Active Pallet Scan Queue (Bay 3)</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Scan barcode tags before forklift loading into truck container
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-xs">
            <div className="p-3.5 rounded-lg border border-accent/40 bg-accent/5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-accent/20 text-accent flex items-center justify-center font-bold text-sm">
                  #6
                </div>
                <div>
                  <div className="font-semibold text-foreground">Pallet #P-06 &bull; SKU-88402 (Dairy Chilled)</div>
                  <div className="text-muted-foreground">Target Drop: Store #42 &bull; Cold-chain verified (+3.8°C)</div>
                </div>
              </div>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
                Confirm Barcode Scan
              </Button>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-accent" />
                <span className="font-semibold text-foreground">Pallet #P-05 (Dry Goods)</span>
                <span className="text-muted-foreground">&bull; Verified in Bay</span>
              </div>
              <Badge variant="outline" className="text-accent border-accent/30">Loaded</Badge>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-warning" />
                <span className="font-semibold text-foreground">Pallet #P-07 (Frozen Goods)</span>
                <span className="text-muted-foreground">&bull; Awaiting Staging</span>
              </div>
              <Badge variant="outline" className="text-warning-foreground border-warning/40 bg-warning/10">Pending</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
