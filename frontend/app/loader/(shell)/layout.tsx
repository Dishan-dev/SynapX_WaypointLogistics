import { LoaderShell } from "@/components/loader/loader-shell";
import { queueMetrics, userLabel } from "@/lib/loader/format";
import { mockCurrentUser, mockDock, mockIssues, mockRuns } from "@/lib/loader/mock-data";

// Signed-in loader screens. The signed-in user comes from mock data until
// sign-in (L2) lands.
export default function LoaderShellLayout({ children }: LayoutProps<"/loader">) {
  const user = userLabel(mockCurrentUser);
  return (
    <LoaderShell
      user={{ name: user.name, initials: user.initials }}
      dockLabel={`${mockDock.depot} · ${mockDock.name}`}
      issueCount={queueMetrics(mockRuns, mockIssues).issues}
    >
      {children}
    </LoaderShell>
  );
}
