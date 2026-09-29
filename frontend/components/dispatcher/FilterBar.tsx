"use client";

import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterBarProps {
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  statusOptions?: { label: string; value: string }[];
  onStatusChange?: (value: string) => void;
  depotOptions?: { label: string; value: string }[];
  onDepotChange?: (value: string) => void;
  actionButton?: React.ReactNode;
}

export function FilterBar({
  searchPlaceholder = "Search...",
  onSearchChange,
  statusOptions,
  onStatusChange,
  depotOptions,
  onDepotChange,
  actionButton,
}: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full bg-card p-3 rounded-lg border border-border">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={searchPlaceholder}
          className="pl-9 bg-background border-border shadow-none"
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </div>
      
      {statusOptions && statusOptions.length > 0 && (
        <Select onValueChange={onStatusChange}>
          <SelectTrigger className="w-full sm:w-[160px] bg-background border-border shadow-none">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {depotOptions && depotOptions.length > 0 && (
        <Select onValueChange={onDepotChange}>
          <SelectTrigger className="w-full sm:w-[160px] bg-background border-border shadow-none">
            <SelectValue placeholder="Depot" />
          </SelectTrigger>
          <SelectContent>
            {depotOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {actionButton && (
        <div className="w-full sm:w-auto mt-2 sm:mt-0">
          {actionButton}
        </div>
      )}
    </div>
  );
}
