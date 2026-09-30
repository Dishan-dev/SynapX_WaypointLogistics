import type { Metadata } from "next";
import {
  currentManager,
  currentOutlet,
  mockCatalogue,
  mockHolidays,
  MOCK_NOW,
  mockOrders,
  OUTLET_UNLOADING,
} from "@/components/store/mock-data";
import { NewRequestForm } from "@/components/store/new-request/new-request-form";

export const metadata: Metadata = {
  title: "New Goods Request | Waypoint Logistics",
};

// Figma: 03 New Goods Request, 03b Add Item, 03c Date Picker, 03d Submit Failed (desktop + mobile).
export default function NewGoodsRequestPage() {
  return (
    <NewRequestForm
      catalogue={mockCatalogue}
      existingOrders={mockOrders}
      holidays={mockHolidays}
      outlet={currentOutlet}
      manager={currentManager}
      unloading={OUTLET_UNLOADING}
      now={MOCK_NOW}
    />
  );
}
