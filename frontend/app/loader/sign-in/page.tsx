import type { Metadata } from "next";
import { Suspense } from "react";
import { dockPlanSource, signInOverview } from "@/lib/loader/format";
import { mockNow, mockQueue, mockRunDetails, mockSummary } from "@/lib/loader/mock-data";
import { SignInView } from "./sign-in-view";

export const metadata: Metadata = { title: "Sign in · Loader" };

// L2 · Who's loading (Figma 00, 1a.1, 1a.2 · tablet 00). The tablet cards
// read this dock's last loaded queue (L3); the mock queue stands in until the
// tablet has loaded one.
export default function LoaderSignInPage() {
  const plan = dockPlanSource(mockRunDetails);
  const overview = signInOverview(mockQueue, mockSummary, plan, mockNow);
  return (
    // The view reads ?reason= and ?next=, so it renders on the client.
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SignInView overview={overview} plan={plan} now={mockNow} />
    </Suspense>
  );
}
