import { MOCK_NOW, mockOrders, mockShortfalls } from "@/components/store/mock-data";
import { GoodsRequestsView } from "@/components/store/requests/goods-requests-view";
import { getRequestSummary, isRequestTab } from "@/components/store/requests/request-filters";

// Figma: Desktop / 02 Goods Requests and Mobile / 02 Goods Requests.
export default async function GoodsRequestsPage({ searchParams }: PageProps<"/store/requests">) {
  const { tab } = await searchParams;
  const initialTab = isRequestTab(tab) ? tab : "active";

  const orders = mockOrders.filter((order) => order.status !== "draft");
  const shortfallOrderNumbers = [
    ...new Set(mockShortfalls.filter((s) => s.status !== "resolved").map((s) => s.orderNumber)),
  ];

  return (
    <GoodsRequestsView
      orders={orders}
      shortfallOrderNumbers={shortfallOrderNumbers}
      initialTab={initialTab}
      summary={getRequestSummary(orders, MOCK_NOW)}
    />
  );
}
