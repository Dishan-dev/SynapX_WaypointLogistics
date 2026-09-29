import { dockPlanSource, userLabel } from "@/lib/loader/format";
import { mockCurrentUser, mockDock, mockIssues, mockNow, mockRuns } from "@/lib/loader/mock-data";
import { QueueView } from "./queue-view";

export default function LoaderQueuePage() {
  return (
    <QueueView
      runs={mockRuns}
      issues={mockIssues}
      firstName={userLabel(mockCurrentUser).shortName.split(" ")[0]}
      dockName={mockDock.name}
      now={mockNow}
      plan={dockPlanSource(mockRuns, mockNow)}
    />
  );
}
