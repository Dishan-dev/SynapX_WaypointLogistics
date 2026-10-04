import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInView } from "./sign-in-view";

export const metadata: Metadata = { title: "Sign in · Loader" };

// Where the tablet lands after its loader session ends (idle, Switch user,
// Sign out). Loaders sign in with their Waypoint (Keycloak) account; the PIN
// pad (Figma 00, 1a.1, 1a.2) is gone.
export default function LoaderSignInPage() {
  return (
    // The view reads ?reason= and ?next=, so it renders on the client.
    <Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <SignInView />
    </Suspense>
  );
}
