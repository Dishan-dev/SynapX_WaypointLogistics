"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LoaderBottomNav, type LoaderTab } from "./loader-bottom-nav";

export interface LoaderShellUser {
  name: string;
  initials: string;
}

interface LoaderShellContextValue {
  openMenu: () => void;
  user: LoaderShellUser;
  /** "Peliyagoda DC · Dock 3" */
  dockLabel: string;
}

const LoaderShellContext = React.createContext<LoaderShellContextValue | null>(null);

export function useLoaderShell(): LoaderShellContextValue {
  const ctx = React.useContext(LoaderShellContext);
  if (!ctx) throw new Error("useLoaderShell must be used inside <LoaderShell>");
  return ctx;
}

function activeTab(pathname: string): LoaderTab | undefined {
  if (pathname === "/loader") return "queue";
  if (pathname.startsWith("/loader/runs/")) return "loading";
  if (pathname.startsWith("/loader/issues")) return "issues";
  if (pathname.startsWith("/loader/log")) return "log";
  return undefined;
}

function runCodeFrom(pathname: string): string | undefined {
  return /^\/loader\/runs\/([^/]+)/.exec(pathname)?.[1];
}

interface LoaderShellProps {
  user: LoaderShellUser;
  dockLabel: string;
  issueCount?: number;
  children: React.ReactNode;
}

/**
 * Frame for signed-in loader screens: page content plus the bottom nav and
 * the menu sheet (opened from the app bar menu or the More tab).
 */
export function LoaderShell({ user, dockLabel, issueCount, children }: LoaderShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Loading tab returns to the run opened last in this session.
  const [lastRunCode, setLastRunCode] = React.useState<string>();
  const currentRunCode = runCodeFrom(pathname);
  if (currentRunCode && currentRunCode !== lastRunCode) setLastRunCode(currentRunCode);

  const ctx = React.useMemo<LoaderShellContextValue>(
    () => ({ openMenu: () => setMenuOpen(true), user, dockLabel }),
    [user, dockLabel],
  );

  return (
    <LoaderShellContext.Provider value={ctx}>
      <div className="flex min-h-dvh flex-col bg-background">
        <div className="flex flex-1 flex-col">{children}</div>
        <LoaderBottomNav
          className="sticky bottom-0 z-30"
          active={activeTab(pathname)}
          loadingHref={lastRunCode ? `/loader/runs/${lastRunCode}` : "/loader"}
          issueCount={issueCount}
          onMore={() => setMenuOpen(true)}
        />
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="gap-0">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{user.name}</SheetTitle>
            <SheetDescription>Loader · {dockLabel}</SheetDescription>
          </SheetHeader>
          <nav aria-label="Loader menu" className="flex flex-col p-2">
            <Link
              href="/loader/sign-in"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-md px-3 text-base font-medium text-foreground outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <UserRound className="size-5 text-muted-foreground" aria-hidden />
              Switch user
            </Link>
          </nav>
        </SheetContent>
      </Sheet>
    </LoaderShellContext.Provider>
  );
}
