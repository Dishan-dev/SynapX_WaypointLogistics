import { SessionGate } from "@/components/loader/loader-session";
import { mockSummary } from "@/lib/loader/mock-data";

// Signed-in loader screens: the user, dock and loader_session_id come from
// this tablet's session (L2 sign-in). The Issues badge reads mock data until
// L3 wires GET /loader/summary.
export default function LoaderShellLayout({ children }: LayoutProps<"/loader">) {
  return <SessionGate issueCount={mockSummary.issues.count}>{children}</SessionGate>;
}
