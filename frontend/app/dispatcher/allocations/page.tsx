"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { MetricCard } from "@/components/dispatcher/MetricCard";
import { FilterBar } from "@/components/dispatcher/FilterBar";
import { AllocationTable } from "@/components/dispatcher/AllocationTable";
import { AllocationFormDrawer } from "@/components/dispatcher/AllocationFormDrawer";
import { AllocationDetailDrawer } from "@/components/dispatcher/AllocationDetailDrawer";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "" },
  { label: "Available", value: "available" },
  { label: "Allocated", value: "allocated" },
  { label: "Ready", value: "ready" },
  { label: "Loading", value: "loading" },
  { label: "Unavailable", value: "unavailable" },
];

const VEHICLE_TYPE_OPTIONS = [
  { label: "All Types", value: "" },
  { label: "Reefer 6T", value: "Reefer 6T" },
  { label: "Dry Box 6T", value: "Dry Box 6T" },
  { label: "Dry Box 10T", value: "Dry Box 10T" },
  { label: "Van 3.5T", value: "Van 3.5T" },
  { label: "Flatbed 15T", value: "Flatbed 15T" },
];

// Figma mock data used as fallback when API is unreachable
const MOCK_ALLOCATIONS = [
  {
    id: 1,
    vehicle: { code: "VEH014", vehicle_type: "Reefer 6T" },
    driver: { user: { full_name: "Kasun Perera" } },
    load_percentage: 82,
    orders: [1, 2, 3, 4, 5, 6],
    run_id: "RUN-024",
    departure_time: "06:00",
    status: "allocated",
  },
  {
    id: 2,
    vehicle: { code: "VEH022", vehicle_type: "Dry Box 6T" },
    driver: { user: { full_name: "Nimal Perera" } },
    load_percentage: 71,
    orders: [1, 2, 3, 4, 5],
    run_id: "RUN-018",
    departure_time: "08:30",
    status: "ready",
  },
  {
    id: 3,
    vehicle: { code: "VEH031", vehicle_type: "Reefer 6T" },
    driver: { user: { full_name: "Amal Fernando" } },
    load_percentage: 94,
    orders: [1, 2, 3, 4],
    run_id: "RUN-029",
    departure_time: "09:00",
    status: "draft",
  },
  {
    id: 4,
    vehicle: { code: "VEH041", vehicle_type: "Dry Box 6T" },
    driver: { user: { full_name: "Unassigned" } },
    load_percentage: 58,
    orders: [1, 2, 3],
    run_id: "—",
    departure_time: "—",
    status: "allocated",
  },
  {
    id: 5,
    vehicle: { code: "VEH008", vehicle_type: "Van 3.5T" },
    driver: { user: { full_name: "—" } },
    load_percentage: 0,
    orders: [],
    run_id: "—",
    departure_time: "—",
    status: "available",
  },
  {
    id: 6,
    vehicle: { code: "VEH019", vehicle_type: "Dry Box 10T" },
    driver: { user: { full_name: "Maintenance" } },
    load_percentage: 0,
    orders: [],
    run_id: "—",
    departure_time: "—",
    status: "unavailable",
  },
];

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Drawer states
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState<any | null>(null);
  const [isReassignDrawerOpen, setIsReassignDrawerOpen] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const fetchAllocations = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:5001/api/v1/allocations/");
      if (response.ok) {
        const data = await response.json();
        setAllocations(data);
      } else {
        console.warn("API unavailable, falling back to mock data.");
      }
    } catch (error) {
      console.warn("Fetch failed, falling back to mock data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  // Use real data if available, fallback to Figma mock data
  const rawData = allocations.length > 0 ? allocations : MOCK_ALLOCATIONS;

  // Filter logic (client-side filtering for now)
  const filteredData = useMemo(() => {
    return rawData.filter((alloc) => {
      const search = searchQuery.toLowerCase();
      const matchesSearch =
        !search ||
        alloc.vehicle?.code?.toLowerCase().includes(search) ||
        alloc.driver?.user?.full_name?.toLowerCase().includes(search) ||
        alloc.run_id?.toLowerCase().includes(search);

      const matchesStatus = !statusFilter || alloc.status.toLowerCase() === statusFilter;
      const matchesType = !typeFilter || alloc.vehicle?.vehicle_type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [rawData, searchQuery, statusFilter, typeFilter]);

  // Dynamic metric counts derived from raw data
  const metrics = useMemo(() => {
    const counts = { available: 0, allocated: 0, loading: 0, ready: 0, unavailable: 0 };
    rawData.forEach((a) => {
      const s = a.status?.toLowerCase();
      if (s === "available") counts.available++;
      else if (s === "allocated" || s === "draft") counts.allocated++;
      else if (s === "loading") counts.loading++;
      else if (s === "ready") counts.ready++;
      else if (s === "unavailable" || s === "cancelled") counts.unavailable++;
    });
    return counts;
  }, [rawData]);

  const handleViewClick = (allocation: any) => {
    setSelectedAllocation(allocation);
  };

  const handleReassignDriver = () => {
    // Close detail drawer and open the reassign/form drawer
    setSelectedAllocation(null);
    setIsReassignDrawerOpen(true);
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicle Allocations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review today's fleet assignments, capacity usage, drivers, and allocation readiness.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="default" onClick={() => setIsFormDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Allocation
          </Button>
        </div>
      </div>

      {/* Metrics Row — counts computed live from data */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard title="Available" value={metrics.available.toString()} />
        <MetricCard title="Allocated" value={metrics.allocated.toString()} />
        <MetricCard title="Loading" value={metrics.loading.toString()} />
        <MetricCard title="Ready" value={metrics.ready.toString()} />
        <MetricCard title="Unavailable" value={metrics.unavailable.toString()} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-4">
        <FilterBar
          searchPlaceholder="Search vehicle, driver or run..."
          onSearchChange={setSearchQuery}
          statusOptions={STATUS_OPTIONS}
          onStatusChange={setStatusFilter}
          depotOptions={VEHICLE_TYPE_OPTIONS}
          onDepotChange={setTypeFilter}
        />

        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading allocations...
          </div>
        ) : (
          <AllocationTable allocations={filteredData} onViewClick={handleViewClick} />
        )}
      </div>

      {/* New Allocation Form Drawer */}
      <AllocationFormDrawer
        open={isFormDrawerOpen}
        onOpenChange={setIsFormDrawerOpen}
        onSuccess={fetchAllocations}
      />

      {/* Reassign Driver quick-open */}
      <AllocationFormDrawer
        open={isReassignDrawerOpen}
        onOpenChange={setIsReassignDrawerOpen}
        onSuccess={fetchAllocations}
      />

      {/* Detail Drawer — opens when View is clicked */}
      <AllocationDetailDrawer
        open={!!selectedAllocation}
        onOpenChange={(open) => { if (!open) setSelectedAllocation(null); }}
        allocation={selectedAllocation}
        onReassignDriver={handleReassignDriver}
      />
    </div>
  );
}
