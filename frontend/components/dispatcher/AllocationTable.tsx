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
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AllocationTableProps {
  allocations: any[]; // We will type this properly later when we fetch from API
}

export function AllocationTable({ allocations }: AllocationTableProps) {
  // Helper to map backend status to frontend badge variants
  const getStatusVariant = (status: string): StatusVariant => {
    switch (status.toLowerCase()) {
      case "allocated":
      case "ready":
        return "primary";
      case "loading":
        return "warning";
      case "dispatched":
      case "completed":
        return "success";
      case "cancelled":
        return "destructive";
      default:
        return "neutral";
    }
  };

  return (
    <div className="rounded-md border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>Vehicle</TableHead>
            <TableHead>Driver</TableHead>
            <TableHead>Capacity Used</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                No vehicle allocations found.
              </TableCell>
            </TableRow>
          ) : (
            allocations.map((allocation) => (
              <TableRow key={allocation.id}>
                <TableCell>
                  <div className="font-medium text-foreground">
                    {allocation.vehicle?.code || "Unassigned"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {allocation.vehicle?.vehicle_type || "N/A"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {allocation.driver?.user?.full_name || "Unassigned"}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={allocation.load_percentage} className="w-[60px]" />
                    <span className="text-xs text-muted-foreground w-8">
                      {allocation.load_percentage}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge 
                    status={allocation.status.toUpperCase()} 
                    variant={getStatusVariant(allocation.status)} 
                  />
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit Allocation</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Cancel Run</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
