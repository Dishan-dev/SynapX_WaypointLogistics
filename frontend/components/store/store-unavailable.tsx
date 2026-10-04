"use client";

import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** Expected API outages should render a useful state instead of failing the server component. */
export function StoreUnavailable() {
  const router = useRouter();

  return (
    <Card role="alert" className="mx-auto w-full max-w-xl items-center gap-4 rounded-lg p-6 text-center ring-border md:p-10">
      <CircleAlert className="size-10 text-destructive" aria-hidden="true" />
      <h1 className="text-xl font-semibold text-primary">Store data is unavailable</h1>
      <p className="text-sm text-muted-foreground">
        We couldn&apos;t load your store right now. Please try again shortly.
      </p>
      <Button onClick={() => router.refresh()} className="h-11 px-6 text-base font-bold md:h-10">
        Try again
      </Button>
    </Card>
  );
}
