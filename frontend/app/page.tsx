"use client";

import React, { useState } from "react";
import {
  Truck,
  Boxes,
  ShieldCheck,
  Activity,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Lock,
  Globe2,
  Sparkles,
  Server,
  Zap,
} from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"fleet" | "inventory" | "tracking">("fleet");

  const keycloakUrl = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "https://auth.tenderease.me";
  const keycloakRealm = process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "waypointlogistics";
  const keycloakClientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "waypoint-frontend";

  // Construct direct Keycloak login URL for instant SSO testing
  const keycloakLoginUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth?client_id=${keycloakClientId}&response_type=code&scope=openid%20profile%20email&redirect_uri=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"
  )}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col">
      {/* Background glowing effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-cyan-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b0f_1px,transparent_1px),linear-gradient(to_bottom,#1e293b0f_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-md sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/25 flex items-center justify-center">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Truck className="h-5 w-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Waypoint Logistics
                </span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Enterprise
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Supply Chain &amp; Warehouse Orchestration</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-400 font-medium">Realm:</span>
              <span className="text-indigo-300 font-semibold">{keycloakRealm}</span>
            </div>

            <a
              href={keycloakLoginUrl}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Lock className="h-4 w-4" />
              <span>Keycloak SSO</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col justify-between">
        {/* Hero Section */}
        <section className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6 backdrop-blur-sm shadow-inner">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>Next.js 16 • FastAPI 0.115 • Hosted Keycloak OIDC</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            Intelligent Supply Chain &amp;{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-teal-300 bg-clip-text text-transparent">
              Operations Control
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
            Coordinating multi-facility inventory, real-time shipment dispatch, delivery tracking, and enterprise identity security for Waypoint Group.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <a
              href={keycloakLoginUrl}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/30 transition-all hover:translate-y-[-1px]"
            >
              <span>Authenticate with SSO</span>
              <ArrowRight className="h-4 w-4" />
            </a>

            <a
              href="http://localhost:5000/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800 font-medium text-sm transition-all"
            >
              <Server className="h-4 w-4 text-cyan-400" />
              <span>FastAPI Documentation</span>
              <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
            </a>
          </div>
        </section>

        {/* Live System Diagnostics & Connection Card */}
        <section className="mb-16">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Live Infrastructure Architecture</h3>
                  <p className="text-xs text-slate-400">Real-time status of connected platform services</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 w-fit">
                <CheckCircle2 className="h-4 w-4" />
                <span>All Core Services Configured</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
              {/* Keycloak Config Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5" /> Identity Provider
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Live
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">Keycloak OIDC</h4>
                  <p className="text-xs text-slate-400 break-all mb-3 font-mono">{keycloakUrl}</p>
                </div>
                <div className="text-xs text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Realm:</span>
                    <span className="text-indigo-300 font-mono font-medium">{keycloakRealm}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Client:</span>
                    <span className="text-slate-300 font-mono">{keycloakClientId}</span>
                  </div>
                </div>
              </div>

              {/* Backend API Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Server className="h-3.5 w-3.5" /> Backend Service
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      Port 5000
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">FastAPI Backend</h4>
                  <p className="text-xs text-slate-400 break-all mb-3 font-mono">http://localhost:5000/api/v1</p>
                </div>
                <div className="text-xs text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Auth Mechanism:</span>
                    <span className="text-slate-300 font-medium">RS256 JWT Verify</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Docs Endpoint:</span>
                    <span className="text-cyan-300 font-mono">/docs (OpenAPI)</span>
                  </div>
                </div>
              </div>

              {/* Database Card */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Persistence
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20">
                      Neon Cloud
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">PostgreSQL DB</h4>
                  <p className="text-xs text-slate-400 mb-3">Pooled connections with SSL enabled</p>
                </div>
                <div className="text-xs text-slate-400 space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Database:</span>
                    <span className="text-teal-300 font-mono font-medium">waypoint</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Driver:</span>
                    <span className="text-slate-300 font-mono">psycopg2-binary</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Feature Demo Tab */}
        <section className="mb-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Core Operational Modules</h2>
            <p className="text-sm text-slate-400">Everything needed to orchestrate deliveries and distribution centers</p>
          </div>

          <div className="flex justify-center mb-8">
            <div className="inline-flex p-1 rounded-xl bg-slate-900 border border-slate-800">
              <button
                onClick={() => setActiveTab("fleet")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === "fleet" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
                }`}
              >
                Fleet &amp; Dispatch
              </button>
              <button
                onClick={() => setActiveTab("inventory")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === "inventory" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
                }`}
              >
                Warehouse Inventory
              </button>
              <button
                onClick={() => setActiveTab("tracking")}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                  activeTab === "tracking" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30" : "text-slate-400 hover:text-white"
                }`}
              >
                Live Tracking &amp; SLA
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6 sm:p-8 backdrop-blur-sm">
            {activeTab === "fleet" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                    <Truck className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Dynamic Route Planning &amp; Dispatch</h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Automated manifest generation, driver workload balancing, and multi-stop delivery route optimization designed for urban and regional distribution networks.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Dynamic ETA calculations taking traffic into account
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Role-based driver dispatch views with mobile support
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Instant digital proof of delivery (POD) capture
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 font-mono text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
                    <span>ACTIVE_MANIFEST #MF-2026-081</span>
                    <span className="text-emerald-400">STATUS: ON_ROUTE</span>
                  </div>
                  <div className="pt-4 space-y-3">
                    <div className="flex justify-between text-slate-300">
                      <span>Assigned Driver:</span>
                      <span className="text-white">Marcus Vance (Fleet ID: #TRK-14)</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Origin:</span>
                      <span className="text-white">Waypoint Central Hub (Bay 4)</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Destinations:</span>
                      <span className="text-white">8 Drops (Progress: 5/8 Completed)</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 mt-4 overflow-hidden border border-slate-800">
                      <div className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full rounded-full w-[62.5%]" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "inventory" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-4">
                    <Boxes className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Multi-Warehouse Inventory Control</h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    Bin-level stock localization, real-time inventory counts, automated low-stock replenishment triggers, and cross-docking visibility.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      SKU barcode scanning and batch tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Automated safety stock and reorder point alerts
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Multi-facility transfer requests &amp; tracking
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 font-mono text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
                    <span>FACILITY: HUB_NORTH_A</span>
                    <span className="text-cyan-400">CAPACITY: 88.4%</span>
                  </div>
                  <div className="pt-4 space-y-3">
                    <div className="flex justify-between text-slate-300">
                      <span>Total SKUs Active:</span>
                      <span className="text-white">14,290 items</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Items Pending Inbound:</span>
                      <span className="text-white">1,400 units</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Low Stock Warnings:</span>
                      <span className="text-amber-400">2 SKUs flagged</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "tracking" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-4">
                    <Globe2 className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">Live Telemetry &amp; SLA Tracking</h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    End-to-end milestone audits with geofencing triggers. Instant customer notifications and compliance verification across all routes.
                  </p>
                  <ul className="space-y-2.5 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Geofenced automatic check-in/check-out
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      Customer-facing tracking portal links
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      SLA performance dashboard with automated logs
                    </li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-5 font-mono text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
                    <span>CONSIGNMENT #WP-88410</span>
                    <span className="text-emerald-400">ON TIME</span>
                  </div>
                  <div className="pt-4 space-y-3">
                    <div className="flex justify-between text-slate-300">
                      <span>Estimated Delivery:</span>
                      <span className="text-white">Today at 16:30</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Current Milestone:</span>
                      <span className="text-cyan-300">Out for Last-Mile Delivery</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Security Stamp:</span>
                      <span className="text-slate-400 font-mono">RS256_VERIFIED</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/90 py-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Waypoint Logistics</span>
            <span>&copy; {new Date().getFullYear()} Waypoint Group. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-400" /> Keycloak SSO Secured
            </span>
            <span>•</span>
            <a
              href="https://auth.tenderease.me/admin/master/console/#/waypointlogistics"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-indigo-400 transition-colors"
            >
              Keycloak Admin
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
