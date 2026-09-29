import { dockPlanSource } from "@/lib/loader/format";
import { mockCurrentUser, mockNow, mockQueue, mockRunDetails, mockSummary } from "@/lib/loader/mock-data";
import { QueueView } from "./queue-view";

export default function LoaderQueuePage() {
  return (
    <QueueView
      queue={mockQueue}
      summary={mockSummary}
      firstName={mockCurrentUser.full_name.split(" ")[0]}
      now={mockNow}
      plan={dockPlanSource(mockRunDetails)}
    />
  );
}
