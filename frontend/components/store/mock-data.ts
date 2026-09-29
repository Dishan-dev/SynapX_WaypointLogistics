// Mock data for the Store Manager portal until the backend (orders, notifications)
// and Keycloak login are wired up. Shapes follow docs/store-manager-contract.md.

export type Brand = "fresh" | "style" | "tech";

export interface StoreOutlet {
  code: string;
  name: string;
  brand: Brand;
  district: string;
  windowStart: string;
  windowEnd: string;
}

export interface StoreManager {
  fullName: string;
  initials: string;
}

export const currentOutlet: StoreOutlet = {
  code: "OUT005",
  name: "Fresh Colombo",
  brand: "fresh",
  district: "Colombo",
  windowStart: "04:00",
  windowEnd: "07:45",
};

export const currentManager: StoreManager = {
  fullName: "Sarah Jenkins",
  initials: "SJ",
};

export const unreadNotificationCount = 4;

export const brandLabels: Record<Brand, string> = {
  fresh: "Fresh",
  style: "Style",
  tech: "Tech",
};
