import { LoaderShell } from "@/components/loader/loader-shell";
import { dockLabel, userLabel } from "@/lib/loader/format";
import { mockCurrentUser, mockSession, mockSummary } from "@/lib/loader/mock-data";

// Signed-in loader screens. The user and dock come from mock data until
// sign-in (L2) lands. There is no session yet, so writes carry
// loader_session_id null (optional on the server until L2).
export default function LoaderShellLayout({ children }: LayoutProps<"/loader">) {
  const user = userLabel(mockCurrentUser);
  return (
    <LoaderShell
      user={{ name: user.name, shortName: user.shortName, initials: user.initials }}
      dockLabel={dockLabel(mockSession)}
      sessionId={null}
      issueCount={mockSummary.issues.count}
    >
      {children}
    </LoaderShell>
  );
}
