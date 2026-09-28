"use client";

import React from "react";
import Link from "next/link";
import { ShieldCheck, ArrowLeft, Users, Lock, ExternalLink, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.tenderease.me";
  const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "waypointlogistics";

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
            Role: System Administrator
          </Badge>
        </div>

        <div className="border-b border-border pb-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              <ShieldCheck className="size-6 text-primary" />
              <span>System Administration &amp; IAM Security</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Keycloak federation, role allocations, user accounts, and infrastructure configuration.
            </p>
          </div>
          <Button asChild size="sm" className="bg-primary text-primary-foreground gap-1.5">
            <a
              href={`${keycloakUrl}/admin/master/console/#/${keycloakRealm}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3.5" />
              <span>Open Keycloak Console</span>
            </a>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Lock className="size-4 text-accent" />
                <span>Identity Realm</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Keycloak Hosted</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold font-mono text-accent">{keycloakRealm}</div>
              <div className="text-xs text-muted-foreground mt-1">RS256 JWT Authorization Active</div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <span>Defined Roles</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Access Control (RBAC)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">5 User Roles</div>
              <div className="text-xs text-muted-foreground mt-1">Admin, Dispatcher, Loader, Driver, Client</div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="size-4 text-accent" />
                <span>Database Instance</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">Neon Serverless</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-foreground">PostgreSQL 16</div>
              <div className="text-xs text-muted-foreground mt-1">SSL Pooled &bull; Alembic Synced</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
