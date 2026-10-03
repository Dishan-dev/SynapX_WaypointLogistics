"use client";

import React, { useState } from "react";
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Lock,
  Mail,
  User as UserIcon,
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
import { AdminUser, adminService } from "@/services/admin-service";

interface UsersTabProps {
  users: AdminUser[];
  isLoading: boolean;
  onRefresh: () => void;
}

export function UsersTab({ users, isLoading, onRefresh }: UsersTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Create Dialog State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    full_name: "",
    email: "",
    password: "",
    role: "DISPATCHER",
    is_active: true,
  });
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    email: "",
    role: "DISPATCHER",
    password: "",
    is_active: true,
  });
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Filter users
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === "ALL" || user.role.toUpperCase() === roleFilter.toUpperCase();

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && user.is_active) ||
      (statusFilter === "INACTIVE" && !user.is_active);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Handle Quick Status Toggle
  const handleToggleStatus = async (user: AdminUser) => {
    try {
      await adminService.toggleUserStatus(user.id, !user.is_active);
      onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to toggle status");
    }
  };

  // Handle Create User
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!createForm.full_name || !createForm.email || !createForm.password) {
      setCreateError("All fields are required.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      await adminService.createUser(createForm);
      setIsCreateOpen(false);
      setCreateForm({
        full_name: "",
        email: "",
        password: "",
        role: "DISPATCHER",
        is_active: true,
      });
      onRefresh();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Creation failed");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Dialog
  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    setEditForm({
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      password: "",
      is_active: user.is_active,
    });
    setEditError("");
    setIsEditOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setEditError("");

    setIsSubmittingEdit(true);
    try {
      await adminService.updateUser(selectedUser.id, {
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
        is_active: editForm.is_active,
        password: editForm.password ? editForm.password : undefined,
      });
      setIsEditOpen(false);
      onRefresh();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role.toUpperCase()) {
      case "ADMIN":
        return <Badge className="bg-purple-100 text-purple-900 border-purple-300">System Admin</Badge>;
      case "DISPATCHER":
        return <Badge className="bg-blue-100 text-blue-900 border-blue-300">Dispatcher</Badge>;
      case "STORE_MANAGER":
      case "WAREHOUSE_MANAGER":
        return <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300">Store Manager</Badge>;
      case "DRIVER":
        return <Badge className="bg-indigo-100 text-indigo-900 border-indigo-300">Driver</Badge>;
      case "LOADER":
        return <Badge className="bg-teal-100 text-teal-900 border-teal-300">Loader</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <span>User Accounts &amp; Access Provisioning</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage operational user credentials, role allocations, and active account status.
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
            <UserPlus className="size-3.5" />
            <span>Create New User</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <Card className="border-border shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Role Filter */}
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Filter by Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="DISPATCHER">Dispatcher</SelectItem>
                <SelectItem value="STORE_MANAGER">Store Manager</SelectItem>
                <SelectItem value="DRIVER">Driver</SelectItem>
                <SelectItem value="LOADER">Loader</SelectItem>
                <SelectItem value="ADMIN">System Administrator</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="text-xs">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active Accounts</SelectItem>
                <SelectItem value="INACTIVE">Disabled Accounts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-border shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="text-xs font-semibold">User Details</TableHead>
              <TableHead className="text-xs font-semibold">Role</TableHead>
              <TableHead className="text-xs font-semibold">Account Status</TableHead>
              <TableHead className="text-xs font-semibold">Registered</TableHead>
              <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                  Loading users...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                  No users found matching current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} className="hover:bg-slate-50/60">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-xs shrink-0">
                        {user.full_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-foreground">{user.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">{getRoleBadge(user.role)}</TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={() => handleToggleStatus(user)}
                      />
                      <span className={`text-[11px] font-medium ${user.is_active ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {user.is_active ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-[11px] text-muted-foreground">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : "System Pre-seed"}
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(user)}
                      className="text-xs gap-1.5 h-8 text-primary hover:bg-slate-100"
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

      {/* Create User Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <UserPlus className="size-4 text-primary" />
              <span>Create New User Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provision a new user for the Waypoint Logistics enterprise system.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateSubmit} className="space-y-4 py-2">
            {createError && (
              <div className="p-2.5 rounded text-xs bg-red-50 text-red-800 border border-red-200">
                {createError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 text-xs"
                  placeholder="e.g. Kasun Silva"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  type="email"
                  className="pl-8 text-xs"
                  placeholder="user@waypoint.com"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                {createForm.role === "LOADER" ? "Dock Tablet PIN (4 digits)" : "Initial Password"}
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  type={createForm.role === "LOADER" ? "text" : "password"}
                  maxLength={createForm.role === "LOADER" ? 4 : undefined}
                  className="pl-8 text-xs"
                  placeholder={createForm.role === "LOADER" ? "e.g. 1234 (4 digits)" : "Temporary password"}
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Assigned Operational Role</Label>
              <Select
                value={createForm.role}
                onValueChange={(val) => setCreateForm({ ...createForm, role: val })}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISPATCHER">Dispatcher (Route Planning &amp; Trips)</SelectItem>
                  <SelectItem value="LOADER">Loader (Dock Loading &amp; Dispatch Scan)</SelectItem>
                  <SelectItem value="STORE_MANAGER">Store Manager (Store Orders &amp; Receipts)</SelectItem>
                  <SelectItem value="DRIVER">Driver (Navigation &amp; Proof of Delivery)</SelectItem>
                  <SelectItem value="ADMIN">System Administrator (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <Label className="text-xs font-semibold">Account Active</Label>
                <p className="text-[11px] text-muted-foreground">Allow immediate login upon creation</p>
              </div>
              <Switch
                checked={createForm.is_active}
                onCheckedChange={(checked) => setCreateForm({ ...createForm, is_active: checked })}
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
                {isSubmittingCreate ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Edit2 className="size-4 text-primary" />
              <span>Edit User Account</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Update credentials and role assignment for {selectedUser?.full_name}.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="space-y-4 py-2">
            {editError && (
              <div className="p-2.5 rounded text-xs bg-red-50 text-red-800 border border-red-200">
                {editError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input
                className="text-xs"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Email Address</Label>
              <Input
                type="email"
                className="text-xs"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Role Allocation</Label>
              <Select
                value={editForm.role}
                onValueChange={(val) => setEditForm({ ...editForm, role: val })}
                disabled={selectedUser?.role === "LOADER"}
              >
                <SelectTrigger className="text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DISPATCHER">Dispatcher</SelectItem>
                  <SelectItem value="LOADER">Loader (Dock Tablet)</SelectItem>
                  <SelectItem value="STORE_MANAGER">Store Manager</SelectItem>
                  <SelectItem value="DRIVER">Driver</SelectItem>
                  <SelectItem value="ADMIN">System Administrator</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                {selectedUser?.role === "LOADER" ? "New 4-digit PIN (Optional)" : "New Password (Optional)"}
              </Label>
              <Input
                type={selectedUser?.role === "LOADER" ? "text" : "password"}
                maxLength={selectedUser?.role === "LOADER" ? 4 : undefined}
                className="text-xs"
                placeholder={selectedUser?.role === "LOADER" ? "Leave blank to keep existing PIN" : "Leave blank to keep existing password"}
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <div>
                <Label className="text-xs font-semibold">Account Active</Label>
                <p className="text-[11px] text-muted-foreground">Enable or disable login access</p>
              </div>
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
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
