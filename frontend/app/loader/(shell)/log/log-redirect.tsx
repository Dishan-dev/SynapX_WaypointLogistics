"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { logHref } from "../runs/[code]/routes";

/** Sends /loader/log to the open run's log, or to the queue when no run is open. */
export function LogRedirect() {
  const router = useRouter();
  const { lastRunCode } = useLoaderShell();

  React.useEffect(() => {
    router.replace(lastRunCode ? logHref(lastRunCode) : "/loader");
  }, [router, lastRunCode]);

  return (
    <p role="status" className="px-4 py-5 text-sm text-muted-foreground">
      Opening the log…
    </p>
  );
}
