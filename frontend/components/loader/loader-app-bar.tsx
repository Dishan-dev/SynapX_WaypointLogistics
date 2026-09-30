import { Bell, Menu } from "lucide-react";
import { cn } from "cn";

interface LoaderAppBarProps {
  title: string;
  /** e.g. "Loader · Peliyagoda DC · Dock 3" or "RUN-021 · Dock tablet 3 · Saman J." */
  subtitle?: string;
  onMenu?: () => void;
  onBell?: () => void;
  /** Red dot on the bell. */
  hasUnread?: boolean;
  /** Menu and bell; off on sign-in, where there is nothing to open yet. */
  showActions?: boolean;
  className?: string;
}

const iconButton =
  "flex size-12 shrink-0 items-center justify-center rounded-md text-primary-foreground outline-none hover:bg-primary-foreground/10 focus-visible:ring-3 focus-visible:ring-primary-foreground/60";

/** Navy app bar at the top of every loader screen. */
export function LoaderAppBar({
  title,
  subtitle,
  onMenu,
  onBell,
  hasUnread = false,
  showActions = true,
  className,
}: LoaderAppBarProps) {
  return (
    <header className={cn("flex h-14 items-center justify-between gap-2 bg-primary px-1", className)}>
      {showActions ? (
        <button type="button" aria-label="Open menu" onClick={onMenu} className={iconButton}>
          <Menu className="size-[22px]" aria-hidden />
        </button>
      ) : (
        <span aria-hidden className="size-12 shrink-0" />
      )}
      <div className="flex min-w-0 flex-col items-center text-center">
        <h1 className="truncate text-base leading-[22px] font-semibold text-primary-foreground">{title}</h1>
        {subtitle && (
          <p className="truncate text-[10px] leading-[14px] font-medium text-primary-foreground/70">{subtitle}</p>
        )}
      </div>
      {showActions ? (
        <button
          type="button"
          aria-label={hasUnread ? "Notifications, new" : "Notifications"}
          onClick={onBell}
          className={cn(iconButton, "relative")}
        >
          <Bell className="size-6" aria-hidden />
          {hasUnread && (
            <span className="absolute top-3 right-3 size-2 rounded-full bg-destructive ring-2 ring-primary" />
          )}
        </button>
      ) : (
        <span aria-hidden className="size-12 shrink-0" />
      )}
    </header>
  );
}
