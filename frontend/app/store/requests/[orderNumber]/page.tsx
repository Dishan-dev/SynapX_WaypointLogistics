import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  currentManager,
  currentOutlet,
  MOCK_NOW,
  mockOrders,
  OUTLET_UNLOADING,
} from "@/components/store/mock-data";
import { RequestDetailView } from "@/components/store/request-detail/request-detail-view";

const findOrder = (orderNumber: string) =>
  mockOrders.find((order) => order.orderNumber.toLowerCase() === orderNumber.toLowerCase());

export async function generateMetadata({ params }: PageProps<"/store/requests/[orderNumber]">): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `${findOrder(orderNumber)?.orderNumber ?? "Request"} | Waypoint Logistics` };
}

// Figma: 04 Goods Request Details and 04b Dispatcher Note (desktop + mobile).
export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps<"/store/requests/[orderNumber]">) {
  const { orderNumber } = await params;
  // ?note=SKU-014 opens that item's dispatcher note (linked from Notifications).
  const { note } = await searchParams;
  const order = findOrder(orderNumber);
  if (!order) notFound();

  return (
    <RequestDetailView
      order={order}
      outlet={currentOutlet}
      manager={currentManager}
      unloading={OUTLET_UNLOADING}
      now={MOCK_NOW}
      initialNoteSku={typeof note === "string" ? note : undefined}
    />
  );
}
