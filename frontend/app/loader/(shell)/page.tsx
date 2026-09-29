import { dockPlanSource } from "@/lib/loader/format";
import { mockNow, mockQueue, mockRunDetails, mockSummary } from "@/lib/loader/mock-data";
import { QueueView } from "./queue-view";

export default function LoaderQueuePage() {
  return (
    <QueueView
      queue={mockQueue}
      summary={mockSummary}
      now={mockNow}
      plan={dockPlanSource(mockRunDetails)}
    />
  );
}
