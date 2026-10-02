"use client";

import React, { useState } from "react";
import {
  Truck,
  Plus,
  Search,
  Snowflake,
  Sun,
  Edit2,
  RefreshCw,
  Scale,
  Box,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FleetVehicle, adminService } from "@/services/admin-service";

interface VehiclesTabProps {
  vehicles: FleetVehicle[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function VehiclesTab({ vehicles, isLoading, onRefresh }: VehiclesTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [depotFilter, setDepotFilter] = useState("ALL");
  const [tempFilter, setTempFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Create Dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    vehicle_type: "truck",
    depot_name: "peliyagoda",
    temperature_mode: "ambient",
    capacity_kg: 6000,
    capacity_vol_m3: 20,
    status: "AVAILABLE" as FleetVehicle["status"],
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<FleetVehicle | null>(null);
  const [editForm, setEditForm] = useState({
    vehicle_type: "truck",
    depot_name: "peliyagoda",
    temperature_mode: "ambient",
    capacity_kg: 6000,
    capacity_vol_m3: 20,
    status: "AVAILABLE" as FleetVehicle["status"],
    maintenance_state: "",
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Filter vehicles
  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch = v.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "ALL" || v.vehicle_type.toLowerCase() === typeFilter.toLowerCase();
    const matchesDepot = depotFilter === "ALL" || v.depot_name.toLowerCase() === depotFilter.toLowerCase();
    const matchesTemp = tempFilter === "ALL" || v.temperature_mode.toLowerCase() === tempFilter.toLowerCase();
    const matchesStatus = statusFilter === "ALL" || v.status === statusFilter;

    return matchesSearch && matchesType && matchesDepot && matchesTemp && matchesStatus;
  });

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!createForm.code) {
      setCreateError("Vehicle ID/Code is required.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      await adminService.createVehicle({
        ...createForm,
        code: createForm.code.toUpperCase(),
        capacity_kg: Number(createForm.capacity_kg),
        capacity_vol_m3: Number(createForm.capacity_vol_m3),
      });
      setIsCreateOpen(false);
      setCreateForm({
        code: "",
        vehicle_type: "truck",
        depot_name: "peliyagoda",
        temperature_mode: "ambient",
        capacity_kg: 6000,
        capacity_vol_m3: 20,
        status: "AVAILABLE",
      });
      onRefresh();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (vehicle: FleetVehicle) => {
    setSelectedVehicle(vehicle);
    setEditForm({
      vehicle_type: vehicle.vehicle_type,
      depot_name: vehicle.depot_name,
      temperature_mode: vehicle.temperature_mode,
      capacity_kg: vehicle.capacity_kg,
      capacity_vol_m3: vehicle.capacity_vol_m3,
      status: vehicle.status,
      maintenance_state: vehicle.maintenance_state || "",
    });
    setEditError("");
    setIsEditOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicle) return;
    setEditError("");

    setIsSubmittingEdit(true);
    try {
      await adminService.updateVehicle(selectedVehicle.id, {
        vehicle_type: editForm.vehicle_type,
        depot_name: editForm.depot_name,
        temperature_mode: editForm.temperature_mode,
        capacity_kg: Number(editForm.capacity_kg),
        capacity_vol_m3: Number(editForm.capacity_vol_m3),
        status: editForm.status,
        maintenance_state: editForm.maintenance_state ? editForm.maintenance_state : null,
      });
      setIsEditOpen(false);
      onRefresh();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const getStatusBadge = (status: FleetVehicle["status"]) => {
    switch (status) {
      case "AVAILABLE":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">Available</Badge>;
      case "ALLOCATED":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300">Allocated</Badge>;
      case "LOADING":
        return <Badge className="bg-amber-100 text-amber-900 border-amber-300">Loading Bay</Badge>;
      case "UNAVAILABLE":
        return <Badge className="bg-red-100 text-red-900 border-red-300">Unavailable</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="size-5 text-primary" />
            <span>Fleet Vehicles &amp; Asset Management</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure vehicle capacities, home depots, temperature capabilities, and live operational availability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="text-xs gap-1.5 border-border"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="bg-primary text-primary-foreground text-xs gap-1.5 font-semibold"
          >
            <Plus className="size-3.5" />
            <span>Add Vehicle</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search vehicle code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Type Filter */}
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Vehicle Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="truck">Trucks</SelectItem>
                <SelectItem value="van">Vans</SelectItem>
              </SelectContent>
            </Select>

            {/* Depot Filter */}
            <Select value={depotFilter} onValueChange={setDepotFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Home Depot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Depots</SelectItem>
                <SelectItem value="peliyagoda">Peliyagoda</SelectItem>
                <SelectItem value="kandy">Kandy</SelectItem>
              </SelectContent>
            </Select>

            {/* Temp Mode */}
            <Select value={tempFilter} onValueChange={setTempFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Refrigeration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Refrigeration</SelectItem>
                <SelectItem value="reefer">Reefer (Cold-Chain)</SelectItem>
                <SelectItem value="ambient">Ambient Cargo</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="AVAILABLE">Available</SelectItem>
                <SelectItem value="ALLOCATED">Allocated</SelectItem>
                <SelectItem value="LOADING">Loading</SelectItem>
                <SelectItem value="UNAVAILABLE">Unavailable / Maint</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table */}
      <Card className="border-border shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-xs font-semibold">Vehicle Code</TableHead>
              <TableHead className="text-xs font-semibold">Type &amp; Depot</TableHead>
              <TableHead className="text-xs font-semibold">Refrigerated Capability</TableHead>
              <TableHead className="text-xs font-semibold">Weight &amp; Volume Capacity</TableHead>
              <TableHead className="text-xs font-semibold">Availability / Status</TableHead>
              <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                  Loading fleet vehicles...
                </TableCell>
              </TableRow>
            ) : filteredVehicles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                  No vehicles found matching criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredVehicles.map((vehicle) => {
                const isReefer = vehicle.temperature_mode.toLowerCase() === "reefer";
                return (
                  <TableRow key={vehicle.id} className="hover:bg-slate-50/60">
                    <TableCell className="py-3 font-mono font-bold text-xs text-foreground">
                      {vehicle.code}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="text-xs font-semibold capitalize text-foreground">
                        {vehicle.vehicle_type}
                      </div>
                      <div className="text-[11px] text-muted-foreground capitalize">
                        {vehicle.depot_name} Depot
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      {isReefer ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                          <Snowflake className="size-3 text-blue-600" />
                          <span>Reefer (Chilled)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Sun className="size-3 text-amber-600" />
                          <span>Ambient Cargo</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="text-xs font-medium text-foreground flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Scale className="size-3 text-muted-foreground" />
                          {vehicle.capacity_kg.toLocaleString()} kg
                        </span>
                        <span className="text-muted-foreground">&bull;</span>
                        <span className="flex items-center gap-1">
                          <Box className="size-3 text-muted-foreground" />
                          {vehicle.capacity_vol_m3} m³
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-1">
                        {getStatusBadge(vehicle.status)}
                        {vehicle.maintenance_state && (
                          <div className="text-[10px] text-amber-700 font-medium">
                            &bull; {vehicle.maintenance_state}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(vehicle)}
                          className="text-xs gap-1 h-7 text-primary hover:bg-slate-100"
                        >
                          <Edit2 className="size-3" />
                          <span>Edit</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Vehicle Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Truck className="size-4 text-primary" />
              <span>Register New Vehicle</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a new logistics asset to the fleet inventory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {createError && (
              <div className="p-2.5 rounded text-xs bg-red-50 text-red-800 border border-red-200">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Vehicle Code / Plate ID</Label>
              <Input
                className="text-xs font-mono uppercase"
                placeholder="e.g. VEH060"
                value={createForm.code}
                onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle Type</Label>
                <Select
                  value={createForm.vehicle_type}
                  onValueChange={(val) => setCreateForm({ ...createForm, vehicle_type: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Home Depot</Label>
                <Select
                  value={createForm.depot_name}
                  onValueChange={(val) => setCreateForm({ ...createForm, depot_name: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="peliyagoda">Peliyagoda</SelectItem>
                    <SelectItem value="kandy">Kandy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Temperature Capability</Label>
              <Select
                value={createForm.temperature_mode}
                onValueChange={(val) => setCreateForm({ ...createForm, temperature_mode: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ambient">Ambient (Dry Cargo)</SelectItem>
                  <SelectItem value="reefer">Reefer (Cold Chain Refrigerated)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Weight Capacity (kg)</Label>
                <Input
                  type="number"
                  className="text-xs font-mono"
                  value={createForm.capacity_kg}
                  onChange={(e) => setCreateForm({ ...createForm, capacity_kg: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Volume Capacity (m³)</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="text-xs font-mono"
                  value={createForm.capacity_vol_m3}
                  onChange={(e) => setCreateForm({ ...createForm, capacity_vol_m3: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingCreate}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                {isSubmittingCreate ? "Saving..." : "Add Vehicle"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Vehicle Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit2 className="size-4 text-primary" />
              <span>Edit Vehicle {selectedVehicle?.code}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update capacity parameters, assigned depot, and maintenance state.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {editError && (
              <div className="p-2.5 rounded text-xs bg-red-50 text-red-800 border border-red-200">
                {editError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vehicle Type</Label>
                <Select
                  value={editForm.vehicle_type}
                  onValueChange={(val) => setEditForm({ ...editForm, vehicle_type: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Truck</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Home Depot</Label>
                <Select
                  value={editForm.depot_name}
                  onValueChange={(val) => setEditForm({ ...editForm, depot_name: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="peliyagoda">Peliyagoda</SelectItem>
                    <SelectItem value="kandy">Kandy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Temperature Mode</Label>
                <Select
                  value={editForm.temperature_mode}
                  onValueChange={(val) => setEditForm({ ...editForm, temperature_mode: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ambient">Ambient</SelectItem>
                    <SelectItem value="reefer">Reefer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(val) => setEditForm({ ...editForm, status: val as FleetVehicle["status"] })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVAILABLE">Available</SelectItem>
                    <SelectItem value="ALLOCATED">Allocated</SelectItem>
                    <SelectItem value="LOADING">Loading</SelectItem>
                    <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Weight Capacity (kg)</Label>
                <Input
                  type="number"
                  className="text-xs font-mono"
                  value={editForm.capacity_kg}
                  onChange={(e) => setEditForm({ ...editForm, capacity_kg: Number(e.target.value) })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Volume Capacity (m³)</Label>
                <Input
                  type="number"
                  step="0.1"
                  className="text-xs font-mono"
                  value={editForm.capacity_vol_m3}
                  onChange={(e) => setEditForm({ ...editForm, capacity_vol_m3: Number(e.target.value) })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Maintenance State / Notes</Label>
              <Input
                className="text-xs"
                placeholder="e.g. Under maintenance, Scheduled tire replacement"
                value={editForm.maintenance_state}
                onChange={(e) => setEditForm({ ...editForm, maintenance_state: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingEdit}
                className="bg-primary text-primary-foreground text-xs font-semibold"
              >
                {isSubmittingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
