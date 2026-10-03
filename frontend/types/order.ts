export type OrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CONFIRMED"
  | "PROCESSING"
  | "ALLOCATED"
  | "READY_FOR_DISPATCH"
  | "DEFERRED"
  | "DISPATCHED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export interface OrderItem {
  id: number;
  order_id: number;
  sku: string;
  item_name: string;
  quantity: number;
  unit_price: number;
}

export interface Order {
  id: number;
  order_number: string;
  client_name: string;
  destination_address: string;
  status: OrderStatus;
  total_amount: number;
  brand?: string | null;
  district?: string | null;
  temperature_zone: "Chilled" | "Ambient" | string;
  delivery_window?: string | null;
  weight_kg: number;
  is_priority: boolean;
  is_late: boolean;
  operating_date?: string | null;
  deferral_reason?: string | null;
  allocation_id?: number | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

export interface OrderMetrics {
  total_orders: number;
  confirmed: number;
  unallocated: number;
  allocated: number;
  deferred: number;
  priority: number;
  late: number;
}
