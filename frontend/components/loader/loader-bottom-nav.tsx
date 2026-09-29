import * as React from "react";
import Link from "next/link";
import { Ellipsis, History, List, TriangleAlert, Truck } from "lucide-react";
import { cn } from "cn";

export type LoaderTab = "queue" | "loading" | "issues" | "log";

interface LoaderBottomNavProps {
  active?: LoaderTab;
  /** The run being loaded (/loader/runs/[code]); falls back to the queue. */
  loadingHref?: string;
  /** Open issues, shown as a count on the Issues tab. */
  issueCount?: number;
  onMore: () => void;
  className?: string;
}

const tabClass =
  "relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[10px] leading-[14px] font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset";

/** Queue · Loading · Issues · Log · More. Fixed to the bottom by the shell. */
export function LoaderBottomNav({
  active,
  loadingHref = "/loader",
  issueCount = 0,
  onMore,
  className,
}: LoaderBottomNavProps) {
  const tabs: { id: LoaderTab; label: string; href: string; icon: React.ReactNode }[] = [
    { id: "queue", label: "Queue", href: "/loader", icon: <List className="size-5" aria-hidden /> },
    { id: "loading", label: "Loading", href: loadingHref, icon: <Truck className="size-5" aria-hidden /> },
    { id: "issues", label: "Issues", href: "/loader/issues", icon: <TriangleAlert className="size-5" aria-hidden /> },
    { id: "log", label: "Log", href: "/loader/log", icon: <History className="size-5" aria-hidden /> },
  ];

  return (
    <nav
      aria-label="Loader"
      className={cn("flex border-t border-border bg-card px-1 pb-[env(safe-area-inset-bottom)]", className)}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(tabClass, isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            {tab.icon}
            {tab.label}
            {tab.id === "issues" && issueCount > 0 && (
              <span className="absolute top-2 left-1/2 ml-1.5 min-w-4 rounded-full bg-destructive px-1 text-center text-[10px] leading-4 font-semibold text-white">
                {issueCount}
                <span className="sr-only"> open</span>
              </span>
            )}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className={cn(tabClass, "text-muted-foreground hover:text-foreground")}
      >
        <Ellipsis className="size-5" aria-hidden />
        More
      </button>
    </nav>
  );
}
