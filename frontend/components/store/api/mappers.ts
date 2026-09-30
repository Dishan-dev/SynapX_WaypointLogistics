import {
  mockCatalogue,
  type NotificationCategory,
  type NotificationType,
  type OrderStatus,
  type StoreNotification,
  type StoreOrder,
  type TemperatureClass,
} from "@/components/store/mock-data";

// API response shapes (backend/app/schemas/store_order.py and notification.py).

export interface ApiOrderItem {
  id: number;
  order_id: number;
  sku: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface ApiStoreOrder {
  id: number;
  order_number: string;
  /** Uppercase in the API (e.g. READY_FOR_DISPATCH); the screens use lowercase. */
  status: string;
  outlet_id: number | null;
  brand: string | null;
  temperature_zone: string;
  operating_date: string | null;
  delivery_window: string | null;
  is_priority: boolean;
  units: number | null;
  weight_kg: number;
  total_amount: number;
  notes: string | null;
  submitted_at: string | null;
  cutoff_at: string | null;
  deferral_reason: string | null;
  deferral_count: number;
  items: ApiOrderItem[];
  created_at: string;
  updated_at: string;
}

export interface ApiNotification {
  id: number;
  outlet_id: number;
  order_id: number | null;
  order_number: string | null;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export interface ApiOperatingDays {
  operating_days: string[];
  earliest_default: string;
  earliest_high_priority: string;
}

const catalogueBySku = new Map(mockCatalogue.map((item) => [item.sku, item]));

export function toTemperatureClass(zone: string): TemperatureClass {
  return zone.toLowerCase() === "chilled" ? "chilled" : "ambient";
}

export function toTemperatureZone(temperature: TemperatureClass) {
  return temperature === "chilled" ? "Chilled" : "Ambient";
}

export function toStoreOrder(order: ApiStoreOrder): StoreOrder {
  const temperatureClass = toTemperatureClass(order.temperature_zone);
  return {
    id: order.id,
    orderNumber: order.order_number,
    status: order.status.toLowerCase() as OrderStatus,
    isHighPriority: order.is_priority,
    temperatureClass,
    orderDate: order.operating_date ?? order.created_at.slice(0, 10),
    submittedAt: order.submitted_at ?? order.created_at,
    notes: order.notes ?? undefined,
    deferralReason: order.deferral_reason ?? undefined,
    statusTimes: order.submitted_at ? { submitted: order.submitted_at } : undefined,
    items: order.items.map((item) => {
      // The API doesn't have catalogue details yet (contract Q4), so category and unit come from the catalogue.
      const catalogue = catalogueBySku.get(item.sku);
      return {
        sku: item.sku,
        itemName: item.item_name,
        category: catalogue?.category ?? "",
        temperatureClass: catalogue?.temperatureClass ?? temperatureClass,
        quantity: item.quantity,
        unitLabel: catalogue?.unitLabel ?? "Units",
      };
    }),
  };
}

// Where each notification type sends the manager (Figma 10: "every notification links to the place to act").
function linksFor(n: ApiNotification): StoreNotification["links"] {
  const order = n.order_number;
  if (!order) return [];
  const view = { label: "View Order", href: `/store/requests/${order}` };
  switch (n.type) {
    case "eta_updated":
      return [{ label: "Open Delivery", href: `/store/deliveries/${order}` }];
    case "delivered":
      return [{ label: "Receive Delivery", href: `/store/deliveries/${order}` }];
    case "dispatcher_note":
    case "shortfall_warning":
      return [{ label: "View Note", href: `/store/requests/${order}` }];
    case "issue_logged":
      return [{ label: "View Issue", href: "/store/issues" }, view];
    case "order_closed":
      return [];
    default:
      return [view];
  }
}

export function toStoreNotification(n: ApiNotification): StoreNotification {
  return {
    id: String(n.id),
    type: n.type,
    category: n.category,
    title: n.title,
    message: n.message ?? "",
    createdAt: n.created_at,
    isRead: n.is_read,
    orderNumber: n.order_number ?? undefined,
    links: linksFor(n),
  };
}
