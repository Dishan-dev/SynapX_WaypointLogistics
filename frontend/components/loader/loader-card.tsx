import * as React from "react";
import { cn } from "cn";
import { Card } from "@/components/ui/card";

interface LoaderCardProps extends Omit<React.ComponentProps<typeof Card>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
}

/** Context card used on loader screens (Capacity, Load map, Change log). */
export function LoaderCard({ title, description, className, children, ...props }: LoaderCardProps) {
  return (
    <Card
      className={cn("gap-3 border border-border px-4 ring-0", className)}
      {...props}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base leading-[22px] font-semibold text-primary">{title}</h2>
        {description && (
          <p className="text-xs leading-[17px] text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </Card>
  );
}
