import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "cn";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// Card surface used across Store Manager screens (Figma: 8px radius, 1px border, 24px padding; 16px on mobile).
const storeCardClass =
  "rounded-lg ring-border [--card-spacing:--spacing(4)] md:[--card-spacing:--spacing(6)]";

export function StoreMetricCard({
  label,
  value,
  caption,
  mobileCaption,
  className,
}: {
  label: string;
  value: string | number;
  caption: string;
  /** Shorter caption for the two-column mobile grid. */
  mobileCaption?: string;
  className?: string;
}) {
  return (
    <Card className={cn(storeCardClass, "gap-2", className)}>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm font-medium text-foreground/80">{label}</p>
        <p className="text-2xl font-bold text-primary">{value}</p>
        {mobileCaption ? (
          <p className="text-sm text-muted-foreground">
            <span className="md:hidden">{mobileCaption}</span>
            <span className="hidden md:inline">{caption}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{caption}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function StoreSectionCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(storeCardClass, className)}>
      <CardHeader className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="text-base font-bold text-primary">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Bold primary text link with a trailing arrow ("View all →"). */
export function StoreArrowLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 text-sm font-bold text-primary underline-offset-4 hover:underline md:min-h-0",
        className
      )}
    >
      {children}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  );
}
