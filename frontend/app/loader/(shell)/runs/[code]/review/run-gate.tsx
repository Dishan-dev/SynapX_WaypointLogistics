"use client";

import * as React from "react";
import Link from "next/link";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useStoredSession } from "@/components/loader/loader-session";
import { useLoaderSync } from "@/components/loader/loader-sync-provider";
import { cachedIssues, loadIssues } from "@/lib/loader/offline/issues-cache";
import type { LoaderIssue, Run } from "@/lib/loader/types";
import { loadRun, type LoadResult } from "../checklist-data";

/**
 * Loads a run for the L6 screens (server copy, or this tablet's cached one),
 * with the same loading and not-available states as the checklist.
 */
export function RunGate({
  code,
  title,
  children,
}: {
  code: string;
  title: string;
  children: (run: Run) => React.ReactNode;
}) {
  const { transport } = useLoaderSync();
  const [result, setResult] = React.useState<LoadResult>();

  React.useEffect(() => {
    let cancelled = false;
    void loadRun(code, transport).then((loaded) => {
      if (!cancelled) setResult(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [code, transport]);

  if (!result) {
    return (
      <LoaderScreen title={title}>
        <p role="status" className="text-sm text-muted-foreground">
          Loading {code}…
        </p>
      </LoaderScreen>
    );
  }
  if (result.kind !== "ok") {
    return (
      <LoaderScreen title={title}>
        <div className="mx-auto flex max-w-md flex-col gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center">
          <p className="text-base font-semibold text-primary">
            {result.kind === "not_found"
              ? `${code} is not on this depot's queue.`
              : result.kind === "picked"
                ? `${result.pickedBy} is loading ${code}.`
                : `${code} is not available offline.`}
          </p>
          <Link href="/loader" className="text-sm font-medium text-info underline-offset-4 hover:underline">
            Back to the queue
          </Link>
        </div>
      </LoaderScreen>
    );
  }
  return <>{children(result.run)}</>;
}

/**
 * The run's flags (GET /loader/issues, filtered to the run), from the depot's
 * list so it works offline too; refetched after each sync.
 */
export function useRunIssues(runCode: string): LoaderIssue[] {
  const depot = useStoredSession()?.session.depot;
  const { transport, sync } = useLoaderSync();
  const [issues, setIssues] = React.useState<LoaderIssue[]>(() =>
    depot ? (cachedIssues(depot)?.issues ?? []) : [],
  );

  React.useEffect(() => {
    if (!depot) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      void loadIssues(transport, depot).then((loaded) => {
        if (!cancelled && loaded) setIssues(loaded.issues);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [depot, transport, sync.lastSyncedAt]);

  return React.useMemo(() => issues.filter((i) => i.run_code === runCode), [issues, runCode]);
}
