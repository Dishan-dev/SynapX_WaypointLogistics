import { IssuesView } from "./issues-view";

// L5 · Issues tab (not designed yet): the dock's flags, waiting first, then
// answered. Each opens the waiting / decision screen (L8, /loader/issues/[id]).
export default function LoaderIssuesPage() {
  return <IssuesView />;
}
