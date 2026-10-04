import * as React from "react";
import { LoaderAppBar } from "./loader-app-bar";

interface LoaderGateScreenProps {
  title: string;
  /** Why the loader is here, e.g. "Your account isn't assigned to a depot yet." */
  message?: React.ReactNode;
  /** A note above the message, e.g. "Signed out after 10 min idle." */
  note?: string;
  /** Buttons, stacked. */
  children?: React.ReactNode;
}

/**
 * A full-page loader screen before there is a session: opening one, a refused
 * sign-in, or signed out. No menu or bell, there is nothing to open yet.
 */
export function LoaderGateScreen({ title, message, note, children }: LoaderGateScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <LoaderAppBar title="Loader" subtitle="Waypoint Logistics" showActions={false} className="sticky top-0 z-20" />
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-md flex-col gap-4 text-center">
          {note && (
            <p role="status" className="rounded-lg bg-info-muted px-4 py-3 text-sm text-info-muted-foreground">
              {note}
            </p>
          )}
          <h1 className="text-2xl font-semibold text-primary">{title}</h1>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
          {children && <div className="flex flex-col gap-2">{children}</div>}
        </div>
      </main>
    </div>
  );
}
