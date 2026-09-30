"use client";

import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Shown inside the Store layout when a page's data can't load (e.g. the API is down in api mode).
export default function StoreError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Card role="alert" className="mx-auto w-full max-w-xl items-center gap-4 rounded-lg p-6 text-center ring-border md:p-10">
      <CircleAlert className="size-10 text-destructive" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-primary">Couldn&apos;t load this page</h1>
      <p className="text-sm text-muted-foreground">
        The Waypoint server didn&apos;t respond. Check your connection, then try again.
        {error.digest && <span className="mt-2 block text-xs">Reference: {error.digest}</span>}
      </p>
      <Button onClick={() => retry()} className="h-11 px-6 text-base font-bold md:h-10">
        Try again
      </Button>
    </Card>
  );
}
