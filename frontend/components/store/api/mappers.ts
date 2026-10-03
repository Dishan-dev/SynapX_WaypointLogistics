import {
  mockCatalogue,
  type Brand,
  type CatalogueItem,
  type NotificationCategory,
  type NotificationType,
  type OrderStatus,
  type StoreNotification,
  type StoreOrder,
  type StoreOutlet,
  type TemperatureClass,
} from "@/components/store/mock-data";

// API response shapes (backend/app/schemas/store_order.py and notification.py).

export interface ApiOrderItem {
  id: number;
  order_id: number;
  sku: string;
  item_name: string;
  quantity: number;
  quantity_sent?: number | null;
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
  shortfall: ApiOrderShortfall | null;
  created_at: string;
  updated_at: string;
}

export interface ApiOrderShortfall {
  state: "under_review" | "confirmed";
  units_short: number | null;
  units_total: number | null;
  reasons: string[];
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

export interface ApiCatalogueItem {
  sku: string;
  name: string;
  pack_label: string | null;
  brand: string;
  temperature_zone: string;
  unit_weight_kg: number;
  unit_volume_m3: number;
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

/** "6 unit Chilled Carton" -> "Cartons", "2 unit Shipping Pallet" -> "Pallets". */
function unitLabelFor(pack: string | null) {
  const last = pack?.trim().split(/\s+/).pop();
  return last ? `${last.charAt(0).toUpperCase()}${last.slice(1)}s` : "Units";
}

export function toCatalogueItem(item: ApiCatalogueItem): CatalogueItem {
  return {
    sku: item.sku,
    itemName: item.name,
    packLabel: item.pack_label ?? "",
    temperatureClass: toTemperatureClass(item.temperature_zone),
    unitLabel: unitLabelFor(item.pack_label),
  };
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
    shortfall: order.shortfall
      ? {
          state: order.shortfall.state,
          unitsShort: order.shortfall.units_short ?? undefined,
          unitsTotal: order.shortfall.units_total ?? undefined,
        }
      : undefined,
    items: order.items.map((item) => {
      // Order items don't carry pack details; the mock catalogue fills them in for the demo SKUs.
      const catalogue = catalogueBySku.get(item.sku);
      return {
        sku: item.sku,
        itemName: item.item_name,
        category: catalogue?.packLabel ?? "",
        temperatureClass: catalogue?.temperatureClass ?? temperatureClass,
        quantity: item.quantity,
        quantitySent: item.quantity_sent ?? undefined,
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

export interface ApiOutletSettings {
  outlet_id: number;
  outlet_code: string;
  outlet_name: string;
  brand: string;
  district: string;
  serving_depot: string;
  store_manager: string | null;
  contact_phone: string | null;
  emergency_contact: string | null;
  window_start: string;
  window_end: string;
  dock_type: string;
  vehicle_access: string;
  parking: string;
  driver_check_in_call: boolean;
  share_dock_gate_code: boolean;
  email_alerts_issues: boolean;
  sms_alerts_priority: boolean;
  is_verified: boolean;
  last_synced_at?: string;
}

export function toStoreOutlet(api: ApiOutletSettings): StoreOutlet {
  return {
    code: api.outlet_code,
    name: api.outlet_name,
    brand: api.brand.toLowerCase() as Brand,
    district: api.district,
    windowStart: api.window_start,
    windowEnd: api.window_end,
  };
}

export function toOutletSettings(api: ApiOutletSettings) {
  return {
    outletId: api.outlet_id,
    outletCode: api.outlet_code,
    outletName: api.outlet_name,
    brand: api.brand,
    district: api.district,
    servingDepot: api.serving_depot,
    // Unset contact details come back as null; "" lets the inputs show their placeholders.
    storeManager: api.store_manager ?? "",
    contactPhone: api.contact_phone ?? "",
    emergencyContact: api.emergency_contact ?? "",
    windowStart: api.window_start,
    windowEnd: api.window_end,
    dockType: api.dock_type,
    vehicleAccess: api.vehicle_access,
    parking: api.parking,
    driverCheckInCall: api.driver_check_in_call,
    shareDockGateCode: api.share_dock_gate_code,
    emailAlertsIssues: api.email_alerts_issues,
    smsAlertsPriority: api.sms_alerts_priority,
    isVerified: api.is_verified,
    lastSyncedAt: api.last_synced_at ? new Date(api.last_synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "today at 14:31",
  };
}

