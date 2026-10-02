"use client";

import React, { useState } from "react";
import {
  Store,
  Plus,
  Search,
  Clock,
  MapPin,
  Edit2,
  RefreshCw,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { OutletRecord, adminService } from "@/services/admin-service";

interface OutletsTabProps {
  outlets: OutletRecord[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function OutletsTab({ outlets, isLoading, onRefresh }: OutletsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [depotFilter, setDepotFilter] = useState("ALL");
  const [accessFilter, setAccessFilter] = useState("ALL");

  // Create Dialog
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    code: "",
    name: "",
    brand: "fresh",
    district: "Colombo",
    depot: "peliyagoda",
    dock_type: "rear_dock",
    van_only: false,
    window_start: "06:00",
    window_end: "18:00",
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Dialog
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletRecord | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    district: "",
    depot: "peliyagoda",
    dock_type: "rear_dock",
    van_only: false,
    window_start: "06:00",
    window_end: "18:00",
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Filter outlets
  const filteredOutlets = outlets.filter((o) => {
    const matchesSearch =
      o.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.district.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesBrand = brandFilter === "ALL" || o.brand.toLowerCase() === brandFilter.toLowerCase();
    const matchesDepot = depotFilter === "ALL" || o.depot.toLowerCase() === depotFilter.toLowerCase();
    const matchesAccess =
      accessFilter === "ALL" ||
      (accessFilter === "VAN_ONLY" && o.van_only) ||
      (accessFilter === "TRUCK" && !o.van_only);

    return matchesSearch && matchesBrand && matchesDepot && matchesAccess;
  });

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!createForm.code || !createForm.name || !createForm.district) {
      setCreateError("All fields are required.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      await adminService.createOutlet(createForm);
      setIsCreateOpen(false);
      setCreateForm({
        code: "",
        name: "",
        brand: "fresh",
        district: "Colombo",
        depot: "peliyagoda",
        dock_type: "rear_dock",
        van_only: false,
        window_start: "06:00",
        window_end: "18:00",
      });
      onRefresh();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (outlet: OutletRecord) => {
    setSelectedOutlet(outlet);
    setEditForm({
      name: outlet.name,
      district: outlet.district,
      depot: outlet.depot.toLowerCase(),
      dock_type: outlet.dock_type.toLowerCase(),
      van_only: outlet.van_only,
      window_start: outlet.window_start || "06:00",
      window_end: outlet.window_end || "18:00",
    });
    setEditError("");
    setIsEditOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOutlet) return;
    setEditError("");

    setIsSubmittingEdit(true);
    try {
      await adminService.updateOutlet(selectedOutlet.id, editForm);
      setIsEditOpen(false);
      onRefresh();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const getBrandBadge = (brand: string) => {
    switch (brand.toLowerCase()) {
      case "fresh":
        return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">Fresh Foods</Badge>;
      case "style":
        return <Badge className="bg-pink-100 text-pink-900 border-pink-300">Style Retail</Badge>;
      case "tech":
        return <Badge className="bg-blue-100 text-blue-900 border-blue-300">Tech &amp; Elec</Badge>;
      default:
        return <Badge variant="outline">{brand}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Store className="size-5 text-primary" />
            <span>Retail Outlets &amp; Delivery Destinations</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure outlet profiles, assigned depots, delivery windows, dock unloading types, and vehicle access constraints.
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
            <span>Add Outlet</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search code, name, district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Brand Filter */}
            <Select value={brandFilter} onValueChange={setBrandFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Brand" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Brands</SelectItem>
                <SelectItem value="fresh">Fresh</SelectItem>
                <SelectItem value="style">Style</SelectItem>
                <SelectItem value="tech">Tech</SelectItem>
              </SelectContent>
            </Select>

            {/* Depot Filter */}
            <Select value={depotFilter} onValueChange={setDepotFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Assigned Depot" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Depots</SelectItem>
                <SelectItem value="peliyagoda">Peliyagoda</SelectItem>
                <SelectItem value="kandy">Kandy</SelectItem>
              </SelectContent>
            </Select>

            {/* Access Type Filter */}
            <Select value={accessFilter} onValueChange={setAccessFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Vehicle Access" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Access Types</SelectItem>
                <SelectItem value="VAN_ONLY">Van Only Requirement</SelectItem>
                <SelectItem value="TRUCK">Truck Accessible</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Outlets Table */}
      <Card className="border-border shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-xs font-semibold">Outlet Code &amp; Name</TableHead>
              <TableHead className="text-xs font-semibold">Brand &amp; District</TableHead>
              <TableHead className="text-xs font-semibold">Assigned Depot</TableHead>
              <TableHead className="text-xs font-semibold">Delivery Window</TableHead>
              <TableHead className="text-xs font-semibold">Dock &amp; Access Type</TableHead>
              <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                  Loading outlets...
                </TableCell>
              </TableRow>
            ) : filteredOutlets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                  No outlets found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredOutlets.map((outlet) => (
                <TableRow key={outlet.id} className="hover:bg-slate-50/60">
                  <TableCell className="py-3">
                    <div className="font-mono font-bold text-xs text-primary">{outlet.code}</div>
                    <div className="font-semibold text-xs text-foreground mt-0.5">{outlet.name}</div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div>{getBrandBadge(outlet.brand)}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3 text-muted-foreground" />
                        <span>{outlet.district}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className="text-xs font-semibold text-foreground">
                      {outlet.depot} Depot
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-xs font-medium font-mono text-foreground flex items-center gap-1.5">
                      <Clock className="size-3 text-muted-foreground" />
                      <span>{outlet.window_start || "06:00"} &ndash; {outlet.window_end || "18:00"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1">
                      <div className="text-xs font-medium capitalize text-foreground">
                        {outlet.dock_type.replace("_", " ")}
                      </div>
                      {outlet.van_only ? (
                        <Badge className="bg-purple-100 text-purple-900 border-purple-300 text-[10px]">
                          Van Only Required
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Truck &amp; Van OK</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(outlet)}
                      className="text-xs gap-1 h-7 text-primary hover:bg-slate-100"
                    >
                      <Edit2 className="size-3" />
                      <span>Edit</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Outlet Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Store className="size-4 text-primary" />
              <span>Register New Outlet</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add a retail delivery destination to the logistics network.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {createError && (
              <div className="p-2.5 rounded text-xs bg-red-50 text-red-800 border border-red-200">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Outlet Code</Label>
                <Input
                  className="text-xs font-mono uppercase"
                  placeholder="e.g. OUT121"
                  value={createForm.code}
                  onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Store Brand</Label>
                <Select
                  value={createForm.brand}
                  onValueChange={(val) => setCreateForm({ ...createForm, brand: val })}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fresh">Fresh (Groceries &amp; Chilled)</SelectItem>
                    <SelectItem value="style">Style (Apparel)</SelectItem>
                    <SelectItem value="tech">Tech (Electronics)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Store Name</Label>
              <Input
                className="text-xs"
                placeholder="e.g. Fresh Nugegoda Super"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">District</Label>
                <Input
                  className="text-xs"
                  placeholder="e.g. Colombo, Kandy"
                  value={createForm.district}
                  onChange={(e) => setCreateForm({ ...createForm, district: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Serving Depot</Label>
                <Select
                  value={createForm.depot}
                  onValueChange={(val) => setCreateForm({ ...createForm, depot: val })}
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
                <Label className="text-xs">Window Start</Label>
                <Input
                  type="time"
                  className="text-xs font-mono"
                  value={createForm.window_start}
                  onChange={(e) => setCreateForm({ ...createForm, window_start: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Window End</Label>
                <Input
                  type="time"
                  className="text-xs font-mono"
                  value={createForm.window_end}
                  onChange={(e) => setCreateForm({ ...createForm, window_end: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Dock Unloading Type</Label>
              <Select
                value={createForm.dock_type}
                onValueChange={(val) => setCreateForm({ ...createForm, dock_type: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rear_dock">Rear Dock</SelectItem>
                  <SelectItem value="street">Street Unload</SelectItem>
                  <SelectItem value="mall_bay">Mall Loading Bay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <Label className="text-xs font-semibold">Van Only Access</Label>
                <p className="text-[11px] text-muted-foreground">Prohibits trucks from routing to this location</p>
              </div>
              <Switch
                checked={createForm.van_only}
                onCheckedChange={(checked) => setCreateForm({ ...createForm, van_only: checked })}
              />
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
                {isSubmittingCreate ? "Saving..." : "Add Outlet"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Outlet Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit2 className="size-4 text-primary" />
              <span>Edit Outlet {selectedOutlet?.code}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update delivery timeframe, access restrictions, and assigned depot.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {editError && (
              <div className="p-2.5 rounded text-xs bg-red-50 text-red-800 border border-red-200">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Outlet Name</Label>
              <Input
                className="text-xs"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">District</Label>
                <Input
                  className="text-xs"
                  value={editForm.district}
                  onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Serving Depot</Label>
                <Select
                  value={editForm.depot}
                  onValueChange={(val) => setEditForm({ ...editForm, depot: val })}
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
                <Label className="text-xs">Window Start</Label>
                <Input
                  type="time"
                  className="text-xs font-mono"
                  value={editForm.window_start}
                  onChange={(e) => setEditForm({ ...editForm, window_start: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Window End</Label>
                <Input
                  type="time"
                  className="text-xs font-mono"
                  value={editForm.window_end}
                  onChange={(e) => setEditForm({ ...editForm, window_end: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Dock Unloading Type</Label>
              <Select
                value={editForm.dock_type}
                onValueChange={(val) => setEditForm({ ...editForm, dock_type: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rear_dock">Rear Dock</SelectItem>
                  <SelectItem value="street">Street Unload</SelectItem>
                  <SelectItem value="mall_bay">Mall Loading Bay</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <Label className="text-xs font-semibold">Van Only Access</Label>
                <p className="text-[11px] text-muted-foreground">Prohibits trucks from routing here</p>
              </div>
              <Switch
                checked={editForm.van_only}
                onCheckedChange={(checked) => setEditForm({ ...editForm, van_only: checked })}
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
