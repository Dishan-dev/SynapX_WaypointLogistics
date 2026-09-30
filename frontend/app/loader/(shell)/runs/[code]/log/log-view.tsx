"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { ActivityList } from "@/components/loader/activity-list";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderCard } from "@/components/loader/loader-card";
import { LoaderScreen } from "@/components/loader/loader-screen";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { activityRows, formatTime } from "@/lib/loader/format";
import { useRunActivity } from "../use-run-activity";

const linkClass =
  "rounded-sm text-xs leading-[17px] font-medium text-muted-foreground outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50";

/** The Log tab for one run: every entry, newest first, flat. */
export function LogView({ code }: { code: string }) {
  const { user } = useLoaderShell();
  const activity = useRunActivity(code);
  const offlineSince = activity.status === "ready" && activity.source === "cache" ? activity.fetchedAt : undefined;
  const checklistHref = `/loader/runs/${encodeURIComponent(code)}`;

  return (
    <LoaderScreen title="Activity log" subtitle={`${code} · ${user.shortName}`}>
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <header className="flex flex-col gap-1.5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/loader" className={linkClass}>
              Queue
            </Link>
            <span aria-hidden>/</span>
            <Link href={checklistHref} className={linkClass}>
              {code}
            </Link>
          </nav>
          <h1 className="text-xl leading-[26px] font-semibold text-primary">{code} · Log</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-xs leading-[17px] text-muted-foreground">Newest first · depot time</p>
            {offlineSince && (
              <InfoChip tone="warning" icon={<WifiOff />}>
                Offline · as of {formatTime(offlineSince)}
              </InfoChip>
            )}
          </div>
        </header>

        {activity.status === "ready" ? (
          <LoaderCard title="Activity">
            {activity.events.length > 0 ? (
              <ActivityList rows={activityRows(activity.events)} className="gap-3" />
            ) : (
              <p className="text-sm text-muted-foreground">Nothing logged on {code} yet.</p>
            )}
          </LoaderCard>
        ) : activity.status === "loading" ? (
          <p role="status" className="text-sm text-muted-foreground">
            Loading the log for {code}…
          </p>
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border bg-card p-6 text-center">
            <p className="text-base font-semibold text-primary">
              {activity.status === "not_found" ? `${code} is not on this dock's queue.` : `The log for ${code} is not available offline.`}
            </p>
            <p className="text-sm text-muted-foreground">
              {activity.status === "not_found"
                ? "Check the run code, or pick the run from the queue."
                : "This tablet has not opened it before. Reconnect to load it."}
            </p>
            <Link href="/loader" className="text-sm font-medium text-info underline-offset-4 hover:underline">
              Back to the queue
            </Link>
          </div>
        )}
      </div>
    </LoaderScreen>
  );
}
