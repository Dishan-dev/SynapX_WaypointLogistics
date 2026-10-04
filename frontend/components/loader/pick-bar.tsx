"use client";

import * as React from "react";
import Link from "next/link";
import { isPickConflict, type QueuedAction } from "@/lib/loader/types";
import { AlertRow } from "./alert-row";
import { LoaderButton } from "./loader-button";

/**
 * On a checklist nobody holds: the run must be picked before anything on it
 * can be ticked, flagged or released (the server refuses with RUN_NOT_PICKED).
 */
export function PickBar({
  code,
  picking,
  notice,
  onPick,
}: {
  code: string;
  picking: boolean;
  notice?: string;
  onPick: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-info/40 bg-info-muted p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-info-muted-foreground">Nobody is loading {code}.</p>
        <p className="text-sm text-foreground">Pick it to start. Only you can work on it until you sign out.</p>
        {notice && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {notice}
          </p>
        )}
      </div>
      <LoaderButton className="w-full md:w-auto" disabled={picking} onClick={onPick}>
        {picking ? "Picking…" : `Pick ${code}`}
      </LoaderButton>
    </div>
  );
}

/** "Saman J. is loading RUN-021." from a refused write's error text. */
function pickedByText(action: QueuedAction): string | undefined {
  const message = action.last_error?.split(": ").slice(1).join(": ");
  return message || undefined;
}

/**
 * Another loader holds the run (409 RUN_PICKED_BY_OTHER, on open or on a
 * write that synced after this loader's lock lifted), or this loader put it
 * back (RUN_NOT_PICKED). Refused taps are not retried; the way out is the queue.
 */
export function PickedByOther({ code, pickedBy, rejected }: { code: string; pickedBy?: string; rejected?: QueuedAction[] }) {
  const refused = rejected?.filter((a) => isPickConflict(a.conflict_code)) ?? [];
  const text = pickedBy ? `${pickedBy} is loading ${code}.` : refused.map(pickedByText).find(Boolean);
  if (!text && refused.length === 0) return null;
  const taps = refused.length;
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <AlertRow
        tone="error"
        message={`${text ?? `${code} is not yours to load any more.`}${
          taps ? ` ${taps === 1 ? "1 tap was" : `${taps} taps were`} not saved.` : ""
        }`}
      />
      <Link href="/loader" className="w-fit text-sm font-medium text-info underline-offset-4 hover:underline">
        Back to the queue
      </Link>
    </div>
  );
}
