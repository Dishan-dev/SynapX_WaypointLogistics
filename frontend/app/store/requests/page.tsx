import { mockShortfalls } from "@/components/store/mock-data";
import { STORE_DATA_SOURCE, storeNow } from "@/components/store/api/config";
import { getStoreOrders } from "@/components/store/api/store-data";
import { GoodsRequestsView } from "@/components/store/requests/goods-requests-view";
import { getRequestSummary, isRequestTab } from "@/components/store/requests/request-filters";

// Figma: Desktop / 02 Goods Requests and Mobile / 02 Goods Requests.
export default async function GoodsRequestsPage({ searchParams }: PageProps<"/store/requests">) {
  const { tab } = await searchParams;
  const initialTab = isRequestTab(tab) ? tab : "active";

  const orders = (await getStoreOrders()).filter((order) => order.status !== "draft");
  // Shortfalls come from Dev B's loading flow; there's no API for them yet.
  const shortfalls = STORE_DATA_SOURCE === "api" ? [] : mockShortfalls;
  const shortfallOrderNumbers = [
    ...new Set(shortfalls.filter((s) => s.status !== "resolved").map((s) => s.orderNumber)),
  ];

  return (
    <GoodsRequestsView
      orders={orders}
      shortfallOrderNumbers={shortfallOrderNumbers}
      initialTab={initialTab}
      summary={getRequestSummary(orders, storeNow())}
    />
  );
}
