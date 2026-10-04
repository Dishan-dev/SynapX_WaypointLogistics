import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

export type LoaderButtonVariant = "primary" | "secondary" | "ghost" | "destructive";

const variantClasses: Record<LoaderButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border-border bg-card text-foreground hover:bg-accent",
  ghost: "bg-card text-primary hover:bg-accent",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
};

// Figma "Disabled" and "Locked" share one look regardless of variant.
const inactiveClasses =
  "disabled:border-transparent disabled:bg-background disabled:text-muted-foreground disabled:opacity-100";

interface LoaderButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "variant" | "size"> {
  variant?: LoaderButtonVariant;
  /** Shows a lock icon and disables the button, e.g. "Release locked". */
  locked?: boolean;
}

/** 48px action button from the Figma loader component set (gloved touch). */
export function LoaderButton({
  variant = "primary",
  locked = false,
  disabled,
  className,
  children,
  ...props
}: LoaderButtonProps) {
  return (
    <Button
      disabled={disabled || locked}
      className={cn(
        "h-12 gap-2 rounded-md px-[18px] text-base leading-[22px] font-semibold [&_svg:not([class*='size-'])]:size-[18px]",
        variantClasses[variant],
        inactiveClasses,
        locked && "disabled:border-border",
        className,
      )}
      {...props}
    >
      {locked && <Lock aria-hidden />}
      {children}
    </Button>
  );
}
