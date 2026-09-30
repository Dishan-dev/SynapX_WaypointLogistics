import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

import { DeliveryRun } from "@/app/dispatcher/delivery-runs/page";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001";

interface LoadingShortfallDialogProps {
  run: DeliveryRun;
  onClose: () => void;
  onAction: () => void;
}

export function LoadingShortfallDialog({ run, onClose, onAction }: LoadingShortfallDialogProps) {
  const [isHolding, setIsHolding] = useState(false);
  
  // Extract shortfall data from loading_events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = run.loading_events || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shortfallEvent = events.find((e: any) => e.status === "error");
  const noteParts = shortfallEvent?.note?.split("·") ?? [];
  const affectedStop = noteParts[0]?.trim() ?? "Unknown";
  const issue = noteParts[1]?.trim() ?? "Loading issue";

  // Calculate remaining time and severity
  const now = new Date();
  const depTime = run.departure_time ? new Date(run.departure_time) : null;
  const minsDiff = depTime ? Math.round((depTime.getTime() - now.getTime()) / 60000) : 999;
  const isAtRisk = minsDiff >= 0 && minsDiff <= 30;
  
  const severity = isAtRisk ? "HIGH" : "MEDIUM";
  const severityClass = severity === "HIGH"
    ? "bg-red-50 text-red-600 border border-red-200"
    : "bg-amber-50 text-amber-700 border border-amber-200";

  const handleHoldDeparture = async () => {
    if (!depTime) return;
    
    setIsHolding(true);
    // Add 30 minutes to departure time
    const newDepTime = new Date(depTime.getTime() + 30 * 60000);
    
    try {
      const res = await fetch(`${API_BASE}/api/v1/delivery-runs/${run.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departure_time: newDepTime.toISOString() })
      });
      if (res.ok) {
        toast.success("Departure held by 30 minutes");
        onAction();
        onClose();
      } else {
        toast.error("Failed to hold departure");
      }
    } catch {
      toast.error("Error connecting to server");
    } finally {
      setIsHolding(false);
    }
  };

  const handleAdjustOrder = async () => {
    const headers = { 'Content-Type': 'application/json' };
    try {
      await fetch(`${API_BASE}/api/v1/delivery-runs/${run.id}/add-loading-event`, {
        method: 'POST', headers,
        body: JSON.stringify({
          event: "Shortfall resolved",
          time: format(new Date(), "HH:mm"),
          note: "Order adjusted by dispatcher",
          status: "ok"
        }),
      });
      await fetch(`${API_BASE}/api/v1/delivery-runs/${run.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ open_shortfalls: 0 }),
      });
      toast.success("Order adjusted — shortfall resolved");
      onAction();
      onClose();
    } catch { toast.error("Failed to adjust order"); }
  };

  const handleSendToExceptions = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/delivery-runs/${run.id}/send-to-exceptions`, { method: 'POST' });
      toast.success("Escalated to exceptions");
      onAction();
      onClose();
    } catch { toast.error("Failed to send to exceptions"); }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md bg-white border-0 p-0 rounded-[10px] overflow-hidden">
        
        <div className="p-6">
          <DialogHeader className="mb-5 flex flex-row items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 mb-1">Loading Shortfall</DialogTitle>
              <DialogDescription className="text-slate-500">
                A loading issue remains unresolved close to departure.
              </DialogDescription>
            </div>
            <div className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider shrink-0 ml-4 ${severityClass}`}>
              {severity}
            </div>
          </DialogHeader>

          <h3 className="text-sm font-bold text-slate-900 mb-4">{run.trip_code} · {run.vehicle_number}</h3>

          <div className="grid grid-cols-2 gap-y-4 mb-6">
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Departure</p>
              <p className="text-sm font-semibold text-slate-900">
                {depTime ? format(depTime, "HH:mm") : "-"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Current time</p>
              <p className="text-sm font-semibold text-slate-900">{format(now, "HH:mm")}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Affected stop</p>
              <p className="text-sm font-semibold text-slate-900">{affectedStop}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium mb-1">Issue</p>
              <p className="text-sm font-semibold text-red-600">{issue}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Impact</h4>
            
            <div className="space-y-2">
              <div className="bg-amber-50 border border-amber-100 rounded-[6px] p-2.5 flex items-start gap-2">
                <div>
                  <p className="text-sm font-semibold text-amber-700">Loading incomplete</p>
                  <p className="text-xs text-amber-600/80 font-medium mt-0.5">{run.stops_completed} of {run.stop_count} stops fully loaded</p>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-100 rounded-[6px] p-2.5 flex items-start gap-2">
                <div>
                  <p className="text-sm font-semibold text-red-700">Order discrepancy</p>
                  <p className="text-xs text-red-600/80 font-medium mt-0.5">Expected quantity cannot be loaded as planned</p>
                </div>
              </div>
              
              <div className={`border rounded-[6px] p-2.5 flex items-start gap-2 ${isAtRisk ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <p className={`text-sm font-semibold ${isAtRisk ? 'text-amber-700' : 'text-slate-700'}`}>Departure risk</p>
                  <p className={`text-xs font-medium mt-0.5 ${isAtRisk ? 'text-amber-600/80' : 'text-slate-500'}`}>
                    {minsDiff > 0 ? `${minsDiff} minutes remain before planned departure` : 'Departure time has passed'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Dispatcher actions</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handleAdjustOrder} className="h-11 bg-[#18385F] hover:bg-[#12294a] text-white font-semibold">
                Adjust Order
              </Button>
              <Button onClick={handleHoldDeparture} disabled={isHolding || !depTime} variant="outline" className="h-11 border-slate-200 text-slate-700">
                {isHolding ? "Holding..." : "Hold Departure"}
              </Button>
              <Button onClick={handleSendToExceptions} variant="outline" className="h-11 border-slate-200 text-slate-700">
                Send to Exceptions
              </Button>
              <Button onClick={onClose} variant="outline" className="h-11 border-slate-200 text-slate-700">
                Close
              </Button>
            </div>
          </div>
          
        </div>
      </DialogContent>
    </Dialog>
  );
}
