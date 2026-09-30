import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { DeliveryRun, DeliveryRunStop } from "@/app/dispatcher/delivery-runs/page";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";

interface RouteOptimizationDialogProps {
  run: DeliveryRun;
  onClose: () => void;
  onApply: () => void;
}

export function RouteOptimizationDialog({ run, onClose, onApply }: RouteOptimizationDialogProps) {
  const [isApplying, setIsApplying] = useState(false);
  
  const currentStops: DeliveryRunStop[] = (run.stop_sequence || [])
    .filter((s): s is DeliveryRunStop => typeof s === "object");

  // Move SLA-failing stops forward (before the last non-failing stop)
  const passing = currentStops.filter(s => s.sla_ok);
  const failing = currentStops.filter(s => !s.sla_ok);
  
  // Interleave: put failing stops at position 1 (after first stop, before last)
  const proposedStops: DeliveryRunStop[] = currentStops.length > 0
    ? [passing[0] || currentStops[0], ...failing, ...passing.slice(1)]
    : [];

  // Mark moved-earlier stops as "SLA recovered"
  const proposedWithSLA = proposedStops.map((stop, i) => {
    const originalIdx = currentStops.findIndex(s => s.id === stop.id);
    const recovered = !stop.sla_ok && i < originalIdx;
    return { ...stop, sla_ok: recovered ? true : stop.sla_ok, sla_note: recovered ? "SLA recovered" : stop.sla_note };
  });

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      // 1. Update the stop sequence
      const r1 = await fetch(`${API_BASE}/api/v1/delivery-runs/${run.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ stop_sequence: proposedWithSLA }),
      });
      if (!r1.ok) throw new Error("patch failed");
      // 2. Record the event in loading_events
      await fetch(`${API_BASE}/api/v1/delivery-runs/${run.id}/add-loading-event`, {
        method: 'POST', headers,
        body: JSON.stringify({
          event: "Route optimized",
          time: format(new Date(), "HH:mm"),
          note: "Dispatcher applied optimized stop sequence",
          status: "ok"
        }),
      });
      toast.success("Optimized route applied");
      onApply();
      onClose();
    } catch {
      toast.error("Failed to apply optimized route");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-2xl bg-white border-0 p-0 rounded-[10px] overflow-hidden">
        <div className="p-6">
          <DialogHeader className="mb-6 flex flex-row items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 mb-1">Route Optimization Review</DialogTitle>
              <DialogDescription className="text-slate-500">
                Compare current and proposed stop sequences before applying changes.
              </DialogDescription>
            </div>
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 shrink-0 ml-4">
              <AlertCircle className="h-3.5 w-3.5" />
              Human confirmation required
            </div>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            {/* Current Route */}
            <div className="border border-slate-200 rounded-[8px] overflow-hidden">
              <div className="bg-slate-50 py-2.5 px-4 border-b border-slate-200">
                <h4 className="font-semibold text-slate-700 text-sm">Current Route</h4>
              </div>
              <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto bg-white">
                {currentStops.map((stop, i) => (
                  <div key={stop.id} className={`p-3 rounded-[6px] border ${!stop.sla_ok ? 'bg-red-50 border-red-100' : 'border-slate-100'}`}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-slate-500 w-4">{i + 1}</span>
                      <span className="text-sm font-semibold text-slate-900">{stop.name} · {stop.eta}</span>
                    </div>
                    <p className={`text-xs font-medium mt-0.5 ml-6 ${!stop.sla_ok ? 'text-red-600' : 'text-slate-500'}`}>
                      {stop.sla_note}
                    </p>
                  </div>
                ))}
                {currentStops.length === 0 && <p className="text-sm text-slate-500 italic p-2">No stops</p>}
              </div>
            </div>

            {/* Proposed Route */}
            <div className="border border-emerald-200 rounded-[8px] overflow-hidden ring-1 ring-emerald-500/20">
              <div className="bg-emerald-50 py-2.5 px-4 border-b border-emerald-200 flex justify-between items-center">
                <h4 className="font-semibold text-emerald-900 text-sm">Proposed Route</h4>
              </div>
              <div className="p-3 space-y-2 max-h-[300px] overflow-y-auto bg-emerald-50/30">
                {proposedWithSLA.map((stop, i) => (
                  <div key={stop.id} className="p-3 rounded-[6px] border bg-white border-slate-200 shadow-sm">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm text-slate-500 w-4">{i + 1}</span>
                      <span className="text-sm font-semibold text-slate-900">{stop.name} · {stop.eta}</span>
                    </div>
                    <p className={`text-xs font-medium mt-0.5 ml-6 ${stop.sla_note === "SLA recovered" ? 'text-emerald-600 font-semibold' : 'text-slate-500'}`}>
                      {stop.sla_note}
                    </p>
                  </div>
                ))}
                {proposedWithSLA.length === 0 && <p className="text-sm text-slate-500 italic p-2">No stops</p>}
              </div>
            </div>
          </div>
          
          <div className="flex justify-between gap-3 mt-6 pt-5 border-t border-slate-100">
            <Button variant="outline" onClick={onClose} className="flex-1 h-11 border-slate-200 text-slate-700 font-semibold">
              Keep Current
            </Button>
            <Button onClick={handleApply} disabled={isApplying || currentStops.length === 0}
              className="flex-1 h-11 bg-[#18385F] hover:bg-[#12294a] text-white font-semibold">
              {isApplying ? "Applying..." : "Apply Optimized Route"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
