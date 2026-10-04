"use client";

// Picking a run (POST /loader/runs/{code}/pick): once picked, only this loader
// can open, tick, flag or release it, until they sign out, switch user, go idle
// or put it back. A pick needs a connection: it is never queued offline.

import * as React from "react";
import { useRouter } from "next/navigation";
import { useLoaderShell } from "@/components/loader/loader-shell";
import { useLoaderSync } from "@/components/loader/loader-sync-provider";
import { NetworkError } from "@/lib/loader/offline/transport";
import type { Run } from "@/lib/loader/types";

export interface PickState {
  /** The run being picked right now, if any. */
  picking?: string;
  /** Why the last pick did not go through, for the screen to show. */
  notice?: string;
  pick: (code: string) => Promise<Run | undefined>;
}

/**
 * pick(code) takes the run and, by default, opens its checklist. Resolves to
 * the run when picked (undefined for a run with no detail, as in the mock).
 * onPicked replaces the navigation, e.g. to refresh a checklist in place.
 */
export function usePick({ onPicked }: { onPicked?: (code: string, run?: Run) => void } = {}): PickState {
  const router = useRouter();
  const { transport } = useLoaderSync();
  const { sessionId } = useLoaderShell();
  const [picking, setPicking] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();

  const pick = React.useCallback(
    async (code: string) => {
      if (sessionId === null) return undefined;
      setPicking(code);
      setNotice(undefined);
      try {
        const result = await transport.pickRun(code, sessionId);
        if (result.kind === "picked") {
          if (onPicked) onPicked(code, result.run);
          else if (result.run) router.push(`/loader/runs/${encodeURIComponent(code)}`);
          return result.run;
        }
        setNotice(
          result.kind === "taken"
            ? `${result.pickedBy} picked ${code} first.`
            : `${code} is no longer on this depot's queue.`,
        );
      } catch (err) {
        if (!(err instanceof NetworkError)) throw err;
        setNotice("Picking a run needs a connection. Try again when the tablet is back online.");
      } finally {
        setPicking(undefined);
      }
      return undefined;
    },
    [transport, sessionId, router, onPicked],
  );

  return { picking, notice, pick };
}
