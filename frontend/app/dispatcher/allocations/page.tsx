"use client";

import React, { useEffect, useState } from "react";
import { MetricCard } from "@/components/dispatcher/MetricCard";
import { FilterBar } from "@/components/dispatcher/FilterBar";
import { AllocationTable } from "@/components/dispatcher/AllocationTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function AllocationsPage() {
  const [allocations, setAllocations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // In a real app, we would fetch from our new /api/v1/allocations endpoint here
    // For now, we'll simulate a quick fetch or just provide mock data to see the UI.
    const fetchAllocations = async () => {
      try {
        const response = await fetch("http://localhost:5001/api/v1/allocations");
        if (response.ok) {
          const data = await response.json();
          setAllocations(data);
        } else {
          console.error("Failed to fetch allocations");
        }
      } catch (error) {
        console.error("Error fetching:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllocations();
  }, []);

  // Mock data fallback if API is empty/unreachable
  const displayData = allocations.length > 0 ? allocations : [
    {
      id: 1,
      vehicle: { code: "VEH014", vehicle_type: "Reefer 6T" },
      driver: { user: { full_name: "Kamal Perera" } },
      load_percentage: 85,
      status: "allocated"
    },
    {
      id: 2,
      vehicle: { code: "VEH042", vehicle_type: "Box 10T" },
      driver: { user: { full_name: "Sunil Silva" } },
      load_percentage: 100,
      status: "ready"
    },
    {
      id: 3,
      vehicle: { code: "VEH011", vehicle_type: "Flatbed 15T" },
      driver: { user: { full_name: "Nimal Fernando" } },
      load_percentage: 40,
      status: "loading"
    }
  ];

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Page Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vehicle Allocations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage fleet assignments, drivers, and load capacities.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="default">
            <Plus className="mr-2 h-4 w-4" /> New Allocation
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard title="Total Vehicles" value="45" />
        <MetricCard title="Allocated" value="28" />
        <MetricCard title="Available" value="12" />
        <MetricCard title="In Maintenance" value="3" />
        <MetricCard title="Delayed" value="2" />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-4">
        <FilterBar 
          onSearchChange={() => {}}
          onStatusChange={() => {}}
          onDepotChange={() => {}}
        />
        
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading allocations...
          </div>
        ) : (
          <AllocationTable allocations={displayData} />
        )}
      </div>
    </div>
  );
}
