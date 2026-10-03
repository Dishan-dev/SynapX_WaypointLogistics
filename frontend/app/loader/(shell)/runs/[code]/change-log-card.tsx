"use client";

import { WifiOff } from "lucide-react";
import { ActivityList } from "@/components/loader/activity-list";
import { InfoChip } from "@/components/loader/info-chip";
import { LoaderCard } from "@/components/loader/loader-card";
import { changeLogRows, formatTime } from "@/lib/loader/format";
import { useRunActivity } from "./use-run-activity";

/**
 * The checklist's Change log card (Figma T1c, context rail): the run's last
 * few log lines, oldest first. The full log is the Log tab.
 */
export function ChangeLogCard({ code }: { code: string }) {
  const activity = useRunActivity(code);
  const offlineSince = activity.status === "ready" && activity.source === "cache" ? activity.fetchedAt : undefined;

  return (
    <LoaderCard
      title="Change log"
      description={
        offlineSince && (
          <InfoChip tone="warning" icon={<WifiOff />}>
            Offline · as of {formatTime(offlineSince)}
          </InfoChip>
        )
      }
    >
      {activity.status === "ready" && activity.events.length > 0 ? (
        <ActivityList rows={changeLogRows(activity.events)} />
      ) : (
        <p role="status" className="text-xs leading-[17px] text-muted-foreground">
          {activity.status === "loading"
            ? "Loading…"
            : activity.status === "ready"
              ? "Nothing logged yet."
              : "Not available offline."}
        </p>
      )}
    </LoaderCard>
  );
}
