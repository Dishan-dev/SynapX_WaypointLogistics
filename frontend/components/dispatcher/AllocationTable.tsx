import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, StatusVariant } from "./StatusBadge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AllocationTableProps {
  allocations: any[];
  onViewClick: (allocation: any) => void;
}

export function AllocationTable({ allocations, onViewClick }: AllocationTableProps) {
  const getStatusVariant = (status: string): StatusVariant => {
    switch (status.toLowerCase()) {
      case "allocated":
        return "primary";
      case "ready":
        return "success";
      case "loading":
        return "warning";
      case "dispatched":
      case "completed":
        return "success";
      case "cancelled":
      case "unavailable":
        return "destructive";
      default:
        return "neutral";
    }
  };

  return (
    <Card className="border-border shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Vehicle Allocation Board</CardTitle>
        <CardDescription>
          One row per vehicle. Manage assigned orders, drivers and load readiness.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-6 w-[120px] whitespace-nowrap">Vehicle</TableHead>
                <TableHead className="w-[120px] whitespace-nowrap">Type</TableHead>
                <TableHead className="w-[160px] whitespace-nowrap">Driver</TableHead>
                <TableHead className="w-[140px] whitespace-nowrap">Load</TableHead>
                <TableHead className="w-[80px] whitespace-nowrap">Orders</TableHead>
                <TableHead className="w-[100px] whitespace-nowrap">Run</TableHead>
                <TableHead className="w-[100px] whitespace-nowrap">Departure</TableHead>
                <TableHead className="w-[120px] whitespace-nowrap">Status</TableHead>
                <TableHead className="w-[120px] whitespace-nowrap text-right pr-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocations.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center h-24 text-muted-foreground"
                  >
                    No vehicle allocations found.
                  </TableCell>
                </TableRow>
              ) : (
                allocations.map((allocation) => (
                  <TableRow key={allocation.id} className="hover:bg-muted/30">
                    <TableCell className="pl-6">
                      <div className="font-semibold text-foreground">
                        {allocation.vehicle?.code || "Unassigned"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-muted-foreground">
                        {allocation.vehicle?.vehicle_type || "N/A"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {allocation.driver?.user?.full_name || (
                          <span className="text-muted-foreground italic">Unassigned</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5 w-[80px]">
                        <span className="text-xs font-semibold">
                          {allocation.load_percentage}%
                        </span>
                        <Progress value={allocation.load_percentage} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {allocation.orders?.length || 0}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {allocation.run_id || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {allocation.departure_time || "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={
                          allocation.status.charAt(0).toUpperCase() +
                          allocation.status.slice(1).toLowerCase()
                        }
                        variant={getStatusVariant(allocation.status)}
                      />
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="px-4 shadow-none"
                          onClick={() => onViewClick(allocation)}
                        >
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
