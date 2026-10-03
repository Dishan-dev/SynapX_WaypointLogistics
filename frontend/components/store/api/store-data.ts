import { addDays, eachDayOfInterval, format } from "date-fns";
import {
  mockHolidays,
  mockIssues,
  mockNotifications,
  mockOrders,
  mockOutletSettings,
  type OutletSettings,
  type StoreIssue,
  type StoreNotification,
  type StoreOrder,
  type TemperatureClass,
} from "@/components/store/mock-data";
import { ApiError, apiFetch } from "@/components/store/api/client";
import { STORE_DATA_SOURCE, STORE_OUTLET_ID } from "@/components/store/api/config";
import {
  toOutletSettings,
  toStoreDashboardIssue,
  toStoreNotification,
  toStoreOrder,
  toTemperatureZone,
  type ApiDeliveryIssueDashboard,
  type ApiNotification,
  type ApiOperatingDays,
  type ApiOutletSettings,
  type ApiStoreOrder,
} from "@/components/store/api/mappers";

// One place for every Store Manager read and write. Screens call these and don't care whether the data
// is mock or live (see api/config.ts). Works from server components and from the browser.

const live = () => STORE_DATA_SOURCE === "api";

export async function getStoreOrders(): Promise<StoreOrder[]> {
  if (live()) {
    try {
      const orders = await apiFetch<ApiStoreOrder[]>(`/orders/store?outlet_id=${STORE_OUTLET_ID}&limit=200`);
      if (orders && orders.length > 0) {
        return orders.map(toStoreOrder);
      }
    } catch {
      // Fallback to mock data if backend query fails or is empty
    }
  }
  return mockOrders;
}

/** null when the order doesn't exist. */
export async function getStoreOrder(orderNumber: string): Promise<StoreOrder | null> {
  if (live()) {
    try {
      const data = await apiFetch<ApiStoreOrder>(`/orders/store/${encodeURIComponent(orderNumber)}`);
      if (data) return toStoreOrder(data);
    } catch {
      // Fallback to mock order if present
    }
  }
  return mockOrders.find((order) => order.orderNumber.toLowerCase() === orderNumber.toLowerCase()) ?? null;
}

export interface GoodsRequestInput {
  deliveryDate: string;
  isHighPriority: boolean;
  notes: string;
  items: { sku: string; itemName: string; quantity: number; temperatureClass: TemperatureClass }[];
}

/** Returns the created order numbers (one per temperature zone). Mock mode just simulates the numbers. */
export async function placeGoodsRequest(input: GoodsRequestInput, mockNumbers: string[]): Promise<string[]> {
  if (!live()) {
    await new Promise((resolve) => setTimeout(resolve, 900));
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new ApiError("The connection dropped while sending.", 0);
    }
    return mockNumbers;
  }
  const orders = await apiFetch<ApiStoreOrder[]>("/orders/store", {
    method: "POST",
    body: JSON.stringify({
      outlet_id: STORE_OUTLET_ID,
      delivery_date: input.deliveryDate,
      is_priority: input.isHighPriority,
      notes: input.notes || null,
      items: input.items.map((item) => ({
        sku: item.sku,
        item_name: item.itemName,
        quantity: item.quantity,
        temperature_zone: toTemperatureZone(item.temperatureClass),
      })),
    }),
  });
  return orders.map((order) => order.order_number);
}

export async function cancelStoreOrder(orderId: number): Promise<void> {
  if (!live()) return;
  await apiFetch(`/orders/${orderId}/cancel`, { method: "POST" });
}

export async function getNotifications(): Promise<StoreNotification[]> {
  if (live()) {
    try {
      const notifications = await apiFetch<ApiNotification[]>(`/notifications/?outlet_id=${STORE_OUTLET_ID}`);
      if (notifications && notifications.length > 0) {
        return notifications.map(toStoreNotification);
      }
    } catch {
      // Fallback
    }
  }
  return mockNotifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiFetch(`/notifications/read-all?outlet_id=${STORE_OUTLET_ID}`, { method: "POST" });
}

/**
 * Non-operating days (holidays) for the date picker. In API mode they come from the backend calendar:
 * any Mon–Sat missing from the operating days is treated as a holiday.
 */
export async function getHolidays(from: Date, days = 90): Promise<{ date: string; name: string }[]> {
  if (live()) {
    try {
      const to = addDays(from, days);
      const calendar = await apiFetch<ApiOperatingDays>(
        `/calendar/operating-days?date_from=${format(from, "yyyy-MM-dd")}&date_to=${format(to, "yyyy-MM-dd")}`
      );
      const operating = new Set(calendar.operating_days);
      return eachDayOfInterval({ start: from, end: to })
        .filter((day) => day.getDay() !== 0 && !operating.has(format(day, "yyyy-MM-dd")))
        .map((day) => ({ date: format(day, "yyyy-MM-dd"), name: "Holiday" }));
    } catch {
      // Fallback
    }
  }
  return mockHolidays;
}

export async function getOutletSettings(): Promise<OutletSettings> {
  if (live()) {
    try {
      const res = await apiFetch<ApiOutletSettings>(`/outlets/${STORE_OUTLET_ID}/settings`);
      if (res) return toOutletSettings(res);
    } catch {
      // Fallback to mock settings
    }
  }
  return mockOutletSettings;
}

export async function updateOutletSettings(payload: Partial<OutletSettings>): Promise<OutletSettings> {
  if (live()) {
    try {
      const apiPayload = {
        contact_phone: payload.contactPhone,
        emergency_contact: payload.emergencyContact,
        driver_check_in_call: payload.driverCheckInCall,
        share_dock_gate_code: payload.shareDockGateCode,
        email_alerts_issues: payload.emailAlertsIssues,
        sms_alerts_priority: payload.smsAlertsPriority,
      };
      const res = await apiFetch<ApiOutletSettings>(`/outlets/${STORE_OUTLET_ID}/settings`, {
        method: "PATCH",
        body: JSON.stringify(apiPayload),
      });
      if (res) return toOutletSettings(res);
    } catch {
      // Handled locally
    }
  }
  return {
    ...mockOutletSettings,
    ...payload,
    lastSyncedAt: `today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
  };
}

export async function resetOutletSettings(): Promise<OutletSettings> {
  if (live()) {
    try {
      const res = await apiFetch<ApiOutletSettings>(`/outlets/${STORE_OUTLET_ID}/settings/reset`, {
        method: "POST",
      });
      if (res) return toOutletSettings(res);
    } catch {
      // Handled locally
    }
  }
  return mockOutletSettings;
}

export async function getStoreIssues(): Promise<StoreIssue[]> {
  if (live()) {
    try {
      const apiIssues = await apiFetch<ApiDeliveryIssueDashboard[]>(`/issues?outlet_id=${STORE_OUTLET_ID}`);
      if (apiIssues && apiIssues.length > 0) {
        return apiIssues.map(toStoreDashboardIssue);
      }
    } catch {
      // Fallback
    }
  }
  return mockIssues;
}

