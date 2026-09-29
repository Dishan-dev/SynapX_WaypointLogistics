import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Dashboard header only. The metric cards, deliveries table and attention list come in the next step.
export default function StoreDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-bold text-primary md:text-3xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your requests, upcoming deliveries, and items that need your attention.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 md:flex-row">
          <Button asChild variant="outline" className="hidden h-10 px-4 md:inline-flex">
            <Link href="/store/deliveries">View All Deliveries</Link>
          </Button>
          <Button asChild className="h-11 px-4 md:h-10">
            <Link href="/store/requests/new">
              <Plus aria-hidden="true" />
              New Goods Request
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
