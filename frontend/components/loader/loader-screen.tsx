"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";
import type { PlanSource } from "@/lib/loader/format";
import { LoaderAppBar } from "./loader-app-bar";
import { useLoaderShell } from "./loader-shell";
import { useLoaderSync } from "./loader-sync-provider";
import { PlanSourceStrip } from "./plan-source-strip";

interface LoaderScreenProps {
  title: string;
  /** Defaults to "Loader · <depot> · <dock>". */
  subtitle?: string;
  plan?: PlanSource;
  /** Replaces the strip's "Plan from …" text, e.g. on Ready to depart. */
  stripText?: string;
  hasUnread?: boolean;
  /** Sticky action bar above the bottom nav, e.g. "Review & confirm · 5 of 7". */
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** One loader screen: app bar + plan source strip, content, optional action bar. */
export function LoaderScreen({
  title,
  subtitle,
  plan,
  stripText,
  hasUnread,
  footer,
  className,
  children,
}: LoaderScreenProps) {
  const router = useRouter();
  const { dockLabel } = useLoaderShell();
  const { sync } = useLoaderSync();

  return (
    <>
      <div className="sticky top-0 z-20">
        <LoaderAppBar
          title={title}
          subtitle={subtitle ?? `Loader · ${dockLabel}`}
          hasUnread={hasUnread}
          onMenu={() => router.push("/loader/more")}
        />
        <PlanSourceStrip plan={plan} text={stripText} sync={sync} />
      </div>
      <main className={cn("flex-1 px-4 py-5 md:px-6 md:py-6", className)}>{children}</main>
      {footer && (
        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-card px-4 py-4">
          {footer}
        </div>
      )}
    </>
  );
}
