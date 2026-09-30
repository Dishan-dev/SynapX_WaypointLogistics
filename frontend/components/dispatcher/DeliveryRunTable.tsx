import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/dispatcher/StatusBadge";
import { format } from "date-fns";

import { DeliveryRun } from "@/app/dispatcher/delivery-runs/page";

interface DeliveryRunTableProps {
  runs: DeliveryRun[];
  isLoading: boolean;
  selectedRunId: number | null;
  onRowClick: (run: DeliveryRun) => void;
}

export function DeliveryRunTable({ runs, isLoading, selectedRunId, onRowClick }: DeliveryRunTableProps) {
  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading delivery runs...</div>;
  }

  if (runs.length === 0) {
    return (
      <div className="bg-white border rounded-[8px] p-8 text-center text-slate-500">
        No delivery runs found.
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-[8px] overflow-hidden">
      <Table>
        <TableHeader className="bg-[#F8FAFC]">
          <TableRow className="hover:bg-transparent">
            <TableHead className="font-semibold text-slate-700">Run</TableHead>
            <TableHead className="font-semibold text-slate-700">Vehicle</TableHead>
            <TableHead className="font-semibold text-slate-700">Driver</TableHead>
            <TableHead className="font-semibold text-slate-700">Stops</TableHead>
            <TableHead className="font-semibold text-slate-700">Departure</TableHead>
            <TableHead className="font-semibold text-slate-700">ETA</TableHead>
            <TableHead className="font-semibold text-slate-700">Progress</TableHead>
            <TableHead className="font-semibold text-slate-700 text-right pr-4">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => {
            const isSelected = run.id === selectedRunId;
            const progressPct = run.stop_count > 0 ? (run.stops_completed / run.stop_count) * 100 : 0;
            
            return (
              <TableRow 
                key={run.id} 
                onClick={() => onRowClick(run)}
                className={`cursor-pointer transition-colors ${isSelected ? 'bg-slate-50 border-l-2 border-l-[#18385F]' : 'hover:bg-slate-50'}`}
              >
                <TableCell className="font-medium text-slate-900">{run.trip_code}</TableCell>
                <TableCell className="text-slate-600">{run.vehicle_number}</TableCell>
                <TableCell className="text-slate-600">{run.driver_name}</TableCell>
                <TableCell className="text-slate-600">{run.stop_count}</TableCell>
                <TableCell className="text-slate-600">
                  {run.departure_time ? format(new Date(run.departure_time), "HH:mm") : "-"}
                </TableCell>
                <TableCell className="text-slate-600">
                  {run.estimated_arrival ? format(new Date(run.estimated_arrival), "HH:mm") : "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#18385F]" style={{ width: `${progressPct}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{run.stops_completed}/{run.stop_count}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right pr-4">
                  <StatusBadge
                    status={run.displayStatus === "en_route" ? "On Route" : run.displayStatus.charAt(0).toUpperCase() + run.displayStatus.slice(1)}
                    variant={
                      run.displayStatus === "scheduled" ? "primary" :
                      run.displayStatus === "ready" ? "success" :
                      run.displayStatus === "en_route" ? "info" :
                      run.displayStatus === "delayed" ? "destructive" :
                      run.displayStatus === "completed" ? "neutral" :
                      "neutral"
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
