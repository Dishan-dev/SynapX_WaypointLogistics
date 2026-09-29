import { dockPlanSource } from "@/lib/loader/format";
import { mockRunDetails } from "@/lib/loader/mock-data";
import { QueueView } from "./queue-view";

// L3 · Loading queue. Runs and metrics load in the view (GET /loader/runs,
// /loader/summary). The plan strip reads the mock runs: the queue responses
// have no plan time yet (contract gap).
export default function LoaderQueuePage() {
  return <QueueView plan={dockPlanSource(mockRunDetails)} />;
}
