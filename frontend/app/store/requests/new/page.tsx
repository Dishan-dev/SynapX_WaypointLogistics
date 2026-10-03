import type { Metadata } from "next";
import { currentManager, OUTLET_UNLOADING } from "@/components/store/mock-data";
import { storeNow } from "@/components/store/api/config";
import { getCatalogue, getCurrentOutlet, getHolidays, getStoreOrders } from "@/components/store/api/store-data";
import { NewRequestForm } from "@/components/store/new-request/new-request-form";

export const metadata: Metadata = {
  title: "New Goods Request | Waypoint Logistics",
};

// Figma: 03 New Goods Request, 03b Add Item, 03c Date Picker, 03d Submit Failed (desktop + mobile).
export default async function NewGoodsRequestPage() {
  const now = storeNow();
  const [existingOrders, holidays, outlet, catalogue] = await Promise.all([
    getStoreOrders(),
    getHolidays(now),
    getCurrentOutlet(),
    getCatalogue(),
  ]);
  return (
    <NewRequestForm
      // Only the outlet's own brand items, so a Fresh store never sees Style or Tech goods.
      catalogue={catalogue}
      existingOrders={existingOrders}
      holidays={holidays}
      outlet={outlet}
      manager={currentManager}
      unloading={OUTLET_UNLOADING}
      now={now}
    />
  );
}
