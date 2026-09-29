import { LoaderShell } from "@/components/loader/loader-shell";
import { dockLabel, userLabel } from "@/lib/loader/format";
import { mockCurrentUser, mockSession, mockSummary } from "@/lib/loader/mock-data";

// Signed-in loader screens. The session comes from mock data until sign-in
// (L2) lands.
export default function LoaderShellLayout({ children }: LayoutProps<"/loader">) {
  const user = userLabel(mockCurrentUser);
  return (
    <LoaderShell
      user={{ name: user.name, shortName: user.shortName, initials: user.initials }}
      dockLabel={dockLabel(mockSession)}
      sessionId={mockSession.session_id}
      issueCount={mockSummary.issues.count}
    >
      {children}
    </LoaderShell>
  );
}
