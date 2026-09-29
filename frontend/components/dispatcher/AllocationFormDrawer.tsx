"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface AllocationFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AllocationFormDrawer({ open, onOpenChange, onSuccess }: AllocationFormDrawerProps) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [selectedDriver, setSelectedDriver] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchFormData();
    }
  }, [open]);

  const fetchFormData = async () => {
    setIsLoadingData(true);
    try {
      const [vehRes, drvRes] = await Promise.all([
        fetch("http://localhost:5001/api/v1/fleet/vehicles"),
        fetch("http://localhost:5001/api/v1/fleet/drivers")
      ]);
      if (vehRes.ok) setVehicles(await vehRes.json());
      if (drvRes.ok) setDrivers(await drvRes.json());
    } catch (error) {
      console.error("Error fetching form data", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle || !selectedDriver) return;

    setIsSubmitting(true);
    try {
      const payload = {
        vehicle_id: parseInt(selectedVehicle),
        driver_id: parseInt(selectedDriver),
        load_percentage: 0,
        status: "allocated"
      };

      const res = await fetch("http://localhost:5001/api/v1/allocations/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        onSuccess();
        onOpenChange(false);
        // Reset form
        setSelectedVehicle("");
        setSelectedDriver("");
      } else {
        console.error("Failed to allocate vehicle");
      }
    } catch (error) {
      console.error("Error allocating", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Vehicle Allocation</DialogTitle>
          <DialogDescription>
            Assign a vehicle and a driver to create a new allocation.
          </DialogDescription>
        </DialogHeader>
        
        {isLoadingData ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 mt-6">
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle</Label>
              <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id.toString()}>
                      {v.code} - {v.vehicle_type} ({v.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="driver">Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      {d.user?.full_name || "Unknown Driver"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || !selectedVehicle || !selectedDriver}>
                {isSubmitting ? "Allocating..." : "Allocate Vehicle"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
