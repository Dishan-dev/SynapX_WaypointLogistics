import { QueueView } from "./queue-view";

// L3 · Loading queue. Runs, metrics and the plan strip's time load in the view
// (GET /loader/runs, /loader/summary).
export default function LoaderQueuePage() {
  return <QueueView />;
}
