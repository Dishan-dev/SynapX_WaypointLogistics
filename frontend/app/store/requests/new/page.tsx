import type { Metadata } from "next";
import { currentManager, currentOutlet, mockCatalogue, OUTLET_UNLOADING } from "@/components/store/mock-data";
import { storeNow } from "@/components/store/api/config";
import { getHolidays, getStoreOrders } from "@/components/store/api/store-data";
import { NewRequestForm } from "@/components/store/new-request/new-request-form";

export const metadata: Metadata = {
  title: "New Goods Request | Waypoint Logistics",
};

// Figma: 03 New Goods Request, 03b Add Item, 03c Date Picker, 03d Submit Failed (desktop + mobile).
export default async function NewGoodsRequestPage() {
  const now = storeNow();
  const [existingOrders, holidays] = await Promise.all([getStoreOrders(), getHolidays(now)]);
  return (
    <NewRequestForm
      // The depot catalogue has no API yet (contract Q4: catalogue columns on inventory_items).
      catalogue={mockCatalogue}
      existingOrders={existingOrders}
      holidays={holidays}
      outlet={currentOutlet}
      manager={currentManager}
      unloading={OUTLET_UNLOADING}
      now={now}
    />
  );
}
