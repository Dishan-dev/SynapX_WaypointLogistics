/**
 * Admin Service: Centralized data client for Waypoint Logistics Admin Dashboard
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_display: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RolePermission {
  id: string;
  name: string;
  description: string;
  granted: boolean;
}

export interface RoleDetail {
  key: string;
  name: string;
  display_title: string;
  description: string;
  user_count: number;
  badge_variant: string;
  permissions: RolePermission[];
}

export interface FleetVehicle {
  id: number;
  code: string;
  vehicle_type: string;
  capacity_kg: number;
  capacity_vol_m3: number;
  status: "AVAILABLE" | "ALLOCATED" | "LOADING" | "UNAVAILABLE";
  temperature_mode: string;
  depot_name: string;
  weekly_fuel_status: string;
  trips_today: number;
  trips_planned: number;
  maintenance_state?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OutletRecord {
  id: number;
  code: string;
  name: string;
  brand: string;
  district: string;
  dock_type: string;
  van_only: boolean;
  window_start?: string;
  window_end?: string;
  depot: string;
}

export interface DepotDetail {
  key: string;
  name: string;
  code: string;
  address: string;
  district: string;
  dock_count: number;
  docks: Array<{ id: number; code: string; name: string; status: string }>;
  tablets: Array<{ id: number; label: string; active: boolean }>;
  vehicle_count: number;
  vehicles: Array<FleetVehicle>;
  outlet_count: number;
  outlets: Array<OutletRecord>;
}

export interface DepotSummary {
  key: string;
  name: string;
  code: string;
  address: string;
  district: string;
  dock_count: number;
  tablet_count: number;
  vehicle_count: number;
  outlet_count: number;
  available_vehicles: number;
  allocated_vehicles: number;
  status: string;
}

export interface OperationalConfigData {
  delivery_windows: {
    standard_start: string;
    standard_end: string;
    morning_start: string;
    morning_end: string;
    afternoon_start: string;
    afternoon_end: string;
    order_cutoff_time: string;
    arrival_buffer_mins: number;
  };
  trip_constraints: {
    max_stops_per_trip: number;
    max_driving_hours_per_day: number;
    weight_capacity_alert_pct: number;
    volume_capacity_alert_pct: number;
    strict_reefer_enforcement: boolean;
    strict_van_only_enforcement: boolean;
  };
}

export interface CalendarDayItem {
  date: string;
  is_operating: boolean;
  festival_ramp: number;
  monsoon: boolean;
  holiday_name?: string | null;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor_email: string;
  actor_name: string;
  action_type: string;
  entity_name: string;
  entity_id?: string;
  summary: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  diff?: Record<string, unknown> | null;
}

export interface SystemSettingsPayload {
  keycloak: {
    url: string;
    realm: string;
    client_id: string;
    token_expiry_minutes: number;
    enable_dev_mode: boolean;
  };
  routing: {
    routing_engine: string;
    geocoding_provider: string;
    offline_sync_interval_mins: number;
    auto_reroute_on_traffic: boolean;
  };
  alerts: {
    email_alerts_issues: boolean;
    sms_alerts_priority: boolean;
    driver_sos_instant_alert: boolean;
    daily_digest_time: string;
  };
  maintenance: {
    maintenance_mode: boolean;
    system_banner_active: boolean;
    banner_message: string;
  };
}

export interface AdminOverview {
  total_users: number;
  active_users: number;
  users_by_role: Record<string, number>;
  total_vehicles: number;
  available_vehicles: number;
  allocated_vehicles: number;
  unavailable_vehicles: number;
  reefer_vehicles: number;
  ambient_vehicles: number;
  total_outlets: number;
  outlets_by_brand: Record<string, number>;
  outlets_by_depot: Record<string, number>;
  van_only_outlets: number;
  depots_summary: DepotSummary[];
  system_status: {
    database: string;
    keycloak: string;
    backend: string;
    is_operating_day: boolean;
    festival_ramp: number;
    monsoon_risk: boolean;
    maintenance_mode: boolean;
  };
  recent_audits: AuditLog[];
}

// ── API Methods ──────────────────────────────────────────

export const adminService = {
  // Overview
  async getOverview(): Promise<AdminOverview> {
    const res = await fetch(`${API_BASE}/api/v1/admin/overview`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load admin overview metrics");
    return res.json();
  },

  // Users
  async getUsers(params?: { q?: string; role?: string; is_active?: boolean }): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.role && params.role !== "ALL") query.set("role", params.role);
    if (params?.is_active !== undefined) query.set("is_active", String(params.is_active));

    const res = await fetch(`${API_BASE}/api/v1/admin/users?${query.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load users");
    return res.json();
  },

  async createUser(payload: { email: string; full_name: string; password: string; role: string; is_active?: boolean }): Promise<AdminUser> {
    const res = await fetch(`${API_BASE}/api/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create user");
    }
    return res.json();
  },

  async updateUser(id: number, payload: Partial<AdminUser> & { password?: string }): Promise<AdminUser> {
    const res = await fetch(`${API_BASE}/api/v1/admin/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to update user");
    }
    return res.json();
  },

  async toggleUserStatus(id: number, isActive: boolean): Promise<AdminUser> {
    const res = await fetch(`${API_BASE}/api/v1/admin/users/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (!res.ok) throw new Error("Failed to toggle user status");
    return res.json();
  },

  // Roles & Access
  async getRoles(): Promise<RoleDetail[]> {
    const res = await fetch(`${API_BASE}/api/v1/admin/roles`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch roles & permissions");
    return res.json();
  },

  async assignRole(userId: number, role: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/api/v1/admin/roles/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, role }),
    });
    if (!res.ok) throw new Error("Failed to assign role");
    return res.json();
  },

  // Vehicles Fleet
  async getVehicles(status?: string): Promise<FleetVehicle[]> {
    const url = status && status !== "ALL"
      ? `${API_BASE}/api/v1/fleet/vehicles?status=${status}`
      : `${API_BASE}/api/v1/fleet/vehicles`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch fleet vehicles");
    return res.json();
  },

  async createVehicle(payload: Partial<FleetVehicle>): Promise<FleetVehicle> {
    const res = await fetch(`${API_BASE}/api/v1/fleet/vehicles`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create vehicle");
    }
    return res.json();
  },

  async updateVehicle(id: number, payload: Partial<FleetVehicle>): Promise<FleetVehicle> {
    const res = await fetch(`${API_BASE}/api/v1/fleet/vehicles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update vehicle");
    return res.json();
  },

  async updateVehicleStatus(id: number, status: string): Promise<FleetVehicle> {
    const res = await fetch(`${API_BASE}/api/v1/fleet/vehicles/${id}/status?status=${status}`, {
      method: "PATCH",
    });
    if (!res.ok) throw new Error("Failed to update vehicle status");
    return res.json();
  },

  async deleteVehicle(id: number): Promise<void> {
    const res = await fetch(`${API_BASE}/api/v1/fleet/vehicles/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete vehicle");
  },

  // Outlets
  async getOutlets(params?: { q?: string; brand?: string; depot?: string; district?: string; van_only?: boolean }): Promise<OutletRecord[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.brand && params.brand !== "ALL") query.set("brand", params.brand.toLowerCase());
    if (params?.depot && params.depot !== "ALL") query.set("depot", params.depot.toLowerCase());
    if (params?.district && params.district !== "ALL") query.set("district", params.district);
    if (params?.van_only !== undefined) query.set("van_only", String(params.van_only));

    const res = await fetch(`${API_BASE}/api/v1/outlets?${query.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch outlets");
    return res.json();
  },

  async createOutlet(payload: Partial<OutletRecord>): Promise<OutletRecord> {
    const res = await fetch(`${API_BASE}/api/v1/outlets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to create outlet");
    }
    return res.json();
  },

  async updateOutlet(id: number, payload: Partial<OutletRecord>): Promise<OutletRecord> {
    const res = await fetch(`${API_BASE}/api/v1/outlets/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update outlet");
    return res.json();
  },

  // Depots
  async getDepots(): Promise<{ peliyagoda: DepotDetail; kandy: DepotDetail }> {
    const res = await fetch(`${API_BASE}/api/v1/admin/depots`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch depot details");
    return res.json();
  },

  // Operational Configuration
  async getOperationalConfig(): Promise<OperationalConfigData> {
    const res = await fetch(`${API_BASE}/api/v1/admin/config/operations`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch operational configurations");
    return res.json();
  },

  async updateOperationalConfig(payload: OperationalConfigData): Promise<OperationalConfigData> {
    const res = await fetch(`${API_BASE}/api/v1/admin/config/operations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update operational configurations");
    return res.json();
  },

  async getCalendarDays(limit = 45): Promise<CalendarDayItem[]> {
    const res = await fetch(`${API_BASE}/api/v1/admin/config/calendar-days?limit=${limit}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch calendar days");
    return res.json();
  },

  async updateCalendarDay(dateStr: string, payload: Partial<CalendarDayItem>): Promise<CalendarDayItem> {
    const res = await fetch(`${API_BASE}/api/v1/admin/config/calendar-days/${dateStr}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update calendar day");
    return res.json();
  },

  // Audit Logs
  async getAuditLogs(params?: { action_type?: string; q?: string; limit?: number }): Promise<AuditLog[]> {
    const query = new URLSearchParams();
    if (params?.action_type && params.action_type !== "ALL") query.set("action_type", params.action_type);
    if (params?.q) query.set("q", params.q);
    if (params?.limit) query.set("limit", String(params.limit));

    const res = await fetch(`${API_BASE}/api/v1/admin/audit-logs?${query.toString()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
  },

  // System Settings
  async getSystemSettings(): Promise<SystemSettingsPayload> {
    const res = await fetch(`${API_BASE}/api/v1/admin/settings`, { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to fetch system settings");
    return res.json();
  },

  async updateSystemSettings(payload: SystemSettingsPayload): Promise<SystemSettingsPayload> {
    const res = await fetch(`${API_BASE}/api/v1/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update system settings");
    return res.json();
  },
};
