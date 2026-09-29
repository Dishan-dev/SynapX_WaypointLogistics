import type { Metadata } from "next";
import { Suspense } from "react";
import { dockPlanSource, signInOverview } from "@/lib/loader/format";
import { mockNow, mockQueue, mockRunDetails, mockSummary } from "@/lib/loader/mock-data";
import { SignInView } from "./sign-in-view";

export const metadata: Metadata = { title: "Sign in · Loader" };

// L2 · Who's loading (Figma 00, 1a.1, 1a.2 · tablet 00). The tablet cards
// read the queue's mock data until L3 wires GET /loader/runs and /summary.
export default function LoaderSignInPage() {
  const overview = signInOverview(mockQueue, mockSummary, dockPlanSource(mockRunDetails), mockNow);
  return (
    // The view reads ?reason= and ?next=, so it renders on the client.
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SignInView overview={overview} now={mockNow} />
    </Suspense>
  );
}
