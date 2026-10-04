"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Allocation } from "@/components/dispatcher/AllocationTable";
import { Loader2, PackageX, PackagePlus, Plus, Search } from "lucide-react";
import { fetchWithFallback } from "@/lib/api";
import { Input } from "@/components/ui/input";

export function AdjustAllocationPlanDialog({ allocation, onClose, onSave }: {
  allocation: Allocation;
  onClose: () => void;
  onSave: () => void;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [unallocated, setUnallocated] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [baseVersion, setBaseVersion] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");

  // State for modifications
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [deferred, setDeferred] = useState<Record<string, number>>({});
  
  useEffect(() => {
    let active = true;
    async function loadData() {
      try {
        const [allocRes, unallocRes] = await Promise.all([
          fetchWithFallback(`/api/v1/allocations/${allocation.id}`),
          fetchWithFallback(`/api/v1/orders/?status=UNALLOCATED`) // Ideally pass depot if supported
        ]);
        
        if (!allocRes.ok) throw new Error("Failed to load allocation");
        const allocData = await allocRes.json();
        const unallocData = unallocRes.ok ? await unallocRes.json() : [];
        
        if (active) {
          setOrders(allocData.orders || []);
          // Only show orders that are not already assigned anywhere
          setUnallocated(Array.isArray(unallocData) ? unallocData.filter(o => !o.allocation_id) : []);
        }
        
        // Find base_version if loading
        if (allocation.status === "loading" || allocation.status === "ready") {
          const runsRes = await fetchWithFallback(`/api/v1/delivery-runs/?status=scheduled`);
          if (runsRes.ok) {
            const runsData = await runsRes.json();
            const run = runsData.find((r: any) => r.allocation_id === allocation.id);
            if (run && active && run.loader && run.loader.current_plan_version) {
                 setBaseVersion(run.loader.current_plan_version);
            }
          }
        }
      } catch (err) {
        if (active) toast.error("Could not load orders");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => { active = false; };
  }, [allocation.id, allocation.status]);

  const toggleRemove = (orderNumber: string) => {
    setRemoved(prev => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
    if (deferred[orderNumber] !== undefined) {
      setDeferred(prev => {
        const next = { ...prev };
        delete next[orderNumber];
        return next;
      });
    }
  };

  const toggleAdd = (orderNumber: string) => {
    setAdded(prev => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  };

  const handleSave = async () => {
    if (removed.size === 0 && added.size === 0 && Object.keys(deferred).length === 0) {
      onClose();
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        client_action_id: crypto.randomUUID(),
        base_version: baseVersion,
        remove: Array.from(removed).map(num => ({ order_number: num, reason: "Dispatcher removed" })),
        add: Array.from(added).map(num => ({ order_number: num })),
        move: [],
        defer: Object.entries(deferred).map(([num, qty]) => ({ order_number: num, quantity_sent: qty, reason: "Short-shipped" }))
      };
      
      const res = await fetch(`/api/v1/allocations/${allocation.id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail?.message || errData.detail || "Failed to update plan");
      }
      
      toast.success("Allocation plan updated successfully");
      onSave();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating plan");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = removed.size > 0 || added.size > 0 || Object.keys(deferred).length > 0;
  
  const filteredUnallocated = unallocated.filter(o => 
    !added.has(o.order_number) && 
    (o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) || 
     (o.outlet?.name || "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-[900px] max-h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-50">
        <DialogHeader className="p-6 pb-4 bg-white border-b shadow-sm z-10">
          <DialogTitle className="text-xl">Adjust Allocation Plan</DialogTitle>
          <DialogDescription>
            {allocation.status === "loading" 
              ? "This vehicle is actively loading. Adjustments will automatically sync to the loader's tablet."
              : "Modify the orders on this allocation before sending to the dock."}
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column - Current Allocation */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50 border-r">
              <h3 className="font-semibold text-slate-800 flex items-center justify-between">
                Current Assigned Orders
                <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">{orders.length + added.size} items</span>
              </h3>
              
              <div className="space-y-3">
                {orders.length === 0 && added.size === 0 && (
                  <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center">
                    <PackageX className="size-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">No orders assigned</p>
                  </div>
                )}
                
                {/* Real existing orders */}
                {orders.map((order) => {
                  const isRemoved = removed.has(order.order_number);
                  const isDeferred = deferred[order.order_number] !== undefined;
                  
                  return (
                    <div 
                      key={order.id} 
                      className={`flex flex-col p-4 border rounded-xl transition-all shadow-sm ${
                        isRemoved ? "border-destructive/30 bg-red-50/50" : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`font-medium text-sm ${isRemoved ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                              {order.order_number}
                            </p>
                            {isDeferred && !isRemoved && <span className="bg-amber-100 text-amber-800 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Short-shipped</span>}
                          </div>
                          <p className={`text-xs ${isRemoved ? 'text-slate-400' : 'text-slate-500'}`}>
                            {[order.outlet?.name || order.outlet_id, `${order.weight_kg}kg`, `${order.order_units || order.units || 0} units`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {!isRemoved && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-7 text-xs font-medium"
                              onClick={() => {
                                if (isDeferred) {
                                  const next = {...deferred};
                                  delete next[order.order_number];
                                  setDeferred(next);
                                } else {
                                  setDeferred({...deferred, [order.order_number]: 0});
                                }
                              }}
                            >
                              {isDeferred ? "Reset Qty" : "Short-ship"}
                            </Button>
                          )}
                          <Button 
                            variant={isRemoved ? "outline" : "ghost"}
                            size="sm"
                            className={`h-7 text-xs font-medium ${isRemoved ? "text-destructive border-destructive/30" : "text-slate-500 hover:text-destructive hover:bg-red-50"}`}
                            onClick={() => toggleRemove(order.order_number)}
                          >
                            {isRemoved ? "Undo" : "Remove"}
                          </Button>
                        </div>
                      </div>
                      
                      {isDeferred && !isRemoved && (
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-700">Units to send:</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 line-through mr-2">{order.order_units || order.units || 0}</span>
                            <Input 
                              type="number" 
                              className="h-7 w-20 text-center text-xs"
                              value={deferred[order.order_number]}
                              onChange={(e) => setDeferred({...deferred, [order.order_number]: parseInt(e.target.value) || 0})}
                              min={0}
                              max={(order.order_units || order.units || 0) - 1}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Newly added orders */}
                {Array.from(added).map((orderNum) => {
                  const order = unallocated.find(o => o.order_number === orderNum);
                  if (!order) return null;
                  return (
                    <div key={orderNum} className="flex flex-col p-4 border border-emerald-200 bg-emerald-50/30 rounded-xl transition-all shadow-sm">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-sm text-slate-900">{order.order_number}</p>
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">New</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {[order.outlet?.name || order.outlet_id, `${order.weight_kg}kg`, `${order.order_units || order.units || 0} units`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-destructive" onClick={() => toggleAdd(order.order_number)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column - Unallocated Pool */}
            <div className="flex-1 flex flex-col bg-white">
              <div className="p-4 border-b space-y-3">
                <h3 className="font-semibold text-slate-800">Add Unallocated Orders</h3>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search by order number or outlet..." 
                    className="pl-9 h-9 text-sm"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                {unallocated.length === 0 ? (
                  <div className="text-center p-6 mt-10">
                    <PackagePlus className="size-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm text-slate-500">No unallocated orders available</p>
                  </div>
                ) : filteredUnallocated.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center p-6">No matching orders found.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredUnallocated.map(order => (
                      <div key={order.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white hover:border-primary/50 transition-colors">
                        <div>
                          <p className="font-medium text-sm text-slate-900">{order.order_number}</p>
                          <p className="text-xs text-slate-500 truncate max-w-[200px]">
                            {order.outlet?.name || order.outlet_id || "No Outlet"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-slate-600">{order.weight_kg}kg</span>
                          <Button size="icon" variant="secondary" className="h-7 w-7 rounded-full" onClick={() => toggleAdd(order.order_number)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="px-6 py-4 bg-white border-t z-10 flex justify-between items-center rounded-b-lg">
          <div className="text-sm text-slate-500 hidden sm:block">
            {hasChanges ? <span className="text-primary font-medium">Unsaved adjustments pending</span> : "No changes made yet"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || loading || !hasChanges}>
              {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
              {saving ? "Applying..." : "Apply Adjustments"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
