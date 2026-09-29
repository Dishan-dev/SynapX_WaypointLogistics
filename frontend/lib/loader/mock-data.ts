// Mock data for the loader UI until the /loader API is wired up, in the shapes
// of docs/loader/API_CONTRACT.md. Scenario follows Figma "02 — Loader":
// Peliyagoda DC, Dock 3, Fresh night wave.
//
// - mockQueue / mockSummary match T1b (queue before plan v3 was acknowledged).
// - RUN-021's detail matches T1c (checklist after v3 was acknowledged).
// Outlet names other than OUT027 are placeholders.

import type {
  LoaderIssue,
  LoaderSession,
  LoaderUser,
  Outlet,
  QueueSummary,
  Run,
  RunQueue,
} from "./types";

const DAY = "2026-05-28";
const at = (time: string) => `${DAY}T${time}:00`;

/** Fixed "now" for the mock scenario, so server and client render the same. */
export const mockNow = at("02:20");

export const mockUsers: LoaderUser[] = [
  { id: 1, full_name: "Saman Jayawardena", short_name: "Saman J." },
  { id: 2, full_name: "Tharindu Jayasuriya", short_name: "Tharindu J." },
  { id: 3, full_name: "Nimal Silva", short_name: "Nimal S." },
];

export const mockSession: LoaderSession = {
  session_id: 12,
  loader: { id: 1, short_name: "Saman J." },
  dock: "Dock 3",
  depot: "peliyagoda",
  started_at: at("01:30"),
};

export const mockCurrentUser = mockUsers[0];

const outlet = (
  code: string,
  name: string,
  dock_type: Outlet["dock_type"],
  window_start: string,
  window_end: string,
): Outlet => ({
  code,
  name,
  brand: "fresh",
  district: "Gampaha",
  dock_type,
  van_only: false,
  window_start: `${window_start}:00`,
  window_end: `${window_end}:00`,
});

const RUN_021: Run = {
  code: "RUN-021",
  trip_number: 1,
  brand: "fresh",
  district: "Gampaha",
  wave: "night",
  departs_at: at("03:30"),
  status: "loading",
  current_plan_version: 3,
  dock: "Dock 3",
  vehicle: {
    code: "VEH001",
    vehicle_type: "truck",
    temp_capability: "reefer",
    max_weight_kg: 5510,
    max_volume_m3: 26.4,
  },
  capacity: {
    loaded_weight_kg: 3410,
    planned_weight_kg: 4690,
    max_weight_kg: 5510,
    loaded_volume_m3: 16.6,
    planned_volume_m3: 22.6,
    max_volume_m3: 26.4,
  },
  plan: {
    version: 3,
    published_at: at("02:14"),
    source: "Dispatcher",
    summary: null,
    acknowledged_at: at("02:16"),
    acknowledged_by: "Saman J.",
  },
  unacknowledged_plan_version: null,
  orders_checked: 5,
  orders_total: 7,
  // Ordered by load_position, as the API returns them.
  stops: [
    {
      stop_sequence: 5,
      load_position: 1,
      eta: at("05:44"),
      handling_minutes: 16,
      status: "pending",
      outlet: outlet("OUT027", "Gampaha Market St", "street", "05:00", "07:30"),
      note: "chilled order deferred",
      orders: [
        {
          order_number: "ORD0092307",
          temperature_class: "ambient",
          units: 44,
          weight_kg: 650,
          volume_m3: 3.2,
          state: "loaded",
          checked_at: at("01:41"),
          checked_by: "Saman J.",
        },
        {
          order_number: "ORD0092308",
          temperature_class: "chilled",
          units: 26,
          weight_kg: 380,
          volume_m3: 1.9,
          state: "moved",
          checked_at: null,
          checked_by: null,
          note: "Deferred to Fri 29 May · off truck 02:24",
          changed_in_version: 3,
        },
      ],
    },
    {
      stop_sequence: 4,
      load_position: 2,
      eta: at("05:20"),
      handling_minutes: 18,
      status: "pending",
      outlet: outlet("OUT031", "Gampaha Bus Stand", "rear_dock", "03:00", "08:00"),
      note: "1 dry + 1 chilled",
      orders: [
        {
          order_number: "ORD0092305",
          temperature_class: "ambient",
          units: 48,
          weight_kg: 700,
          volume_m3: 3.4,
          state: "loaded",
          checked_at: at("02:26"),
          checked_by: "Saman J.",
          changed_in_version: 3,
        },
        {
          order_number: "ORD0092306",
          temperature_class: "chilled",
          units: 34,
          weight_kg: 500,
          volume_m3: 2.4,
          state: "loaded",
          checked_at: at("02:26"),
          checked_by: "Saman J.",
          changed_in_version: 3,
        },
      ],
    },
    {
      stop_sequence: 3,
      load_position: 3,
      eta: at("04:56"),
      handling_minutes: 14,
      status: "pending",
      outlet: outlet("OUT030", "Yakkala Junction", "rear_dock", "03:00", "08:00"),
      orders: [
        {
          order_number: "ORD0092303",
          temperature_class: "ambient",
          units: 50,
          weight_kg: 740,
          volume_m3: 3.6,
          state: "loaded",
          checked_at: at("02:05"),
          checked_by: "Saman J.",
        },
        {
          order_number: "ORD0092304",
          temperature_class: "chilled",
          units: 30,
          weight_kg: 440,
          volume_m3: 2.2,
          state: "moved",
          checked_at: null,
          checked_by: null,
          moved_to: "VEH003 · Trip 1 · 03:45",
          changed_in_version: 3,
        },
      ],
    },
    {
      stop_sequence: 2,
      load_position: 4,
      eta: at("04:32"),
      handling_minutes: 18,
      status: "pending",
      outlet: outlet("OUT026", "Miriswatte", "rear_dock", "03:00", "08:00"),
      note: "1 dry + 1 chilled",
      orders: [
        {
          order_number: "ORD0092301",
          temperature_class: "ambient",
          units: 56,
          weight_kg: 820,
          volume_m3: 4.0,
          state: "loaded",
          checked_at: at("02:20"),
          checked_by: "Saman J.",
          loaded_units: 53,
          note: "53 of 56 loaded · 3 damaged, Dispatcher agreed",
        },
        {
          order_number: "ORD0092302",
          temperature_class: "chilled",
          units: 46,
          weight_kg: 690,
          volume_m3: 3.2,
          state: "to_load",
          checked_at: null,
          checked_by: null,
          note: "Next · pick from chiller dock",
        },
      ],
    },
    {
      stop_sequence: 1,
      load_position: 5,
      eta: at("04:07"),
      handling_minutes: 12,
      status: "pending",
      outlet: outlet("OUT028", "Kadawatha", "street", "03:00", "08:00"),
      note: "deferred yesterday",
      is_new: true,
      orders: [
        {
          order_number: "ORD0092319",
          temperature_class: "ambient",
          units: 40,
          weight_kg: 590,
          volume_m3: 2.8,
          state: "new",
          checked_at: null,
          checked_by: null,
          note: "New in v3 · nothing loaded has to move",
          changed_in_version: 3,
        },
      ],
    },
  ],
};

/** Run details available offline in the mock. Other runs are queue-level only. */
export const mockRunDetails: Run[] = [RUN_021];

export function findMockRun(code: string): Run | undefined {
  return mockRunDetails.find((run) => run.code === code);
}

// ---- Queue (GET /loader/runs, GET /loader/summary) -----------------------

export const mockSummary: QueueSummary = {
  dock: "Dock 3",
  date: DAY,
  day_label: "Thu 28 May",
  next_holiday: { date: "2026-05-30", label: "Poson Sat 30 May" },
  runs: 6,
  loading: { count: 2, loaders: ["Saman", "Tharindu"] },
  issues: { count: 1, label: "Awaiting decision" },
  ready: { count: 1, run_codes: ["RUN-022"] },
};

export const mockQueue: RunQueue = {
  groups: [
    {
      label: "Fresh · night wave",
      brand: "fresh",
      wave: "night",
      runs: [
        {
          code: "RUN-021",
          vehicle_code: "VEH001",
          vehicle_type: "truck",
          temp_capability: "reefer",
          trip_number: 1,
          brand: "fresh",
          district: "Gampaha",
          departs_at: at("03:30"),
          status: "loading",
          stop_count: 4,
          orders_checked: 5,
          orders_total: 8,
          loader: "Saman J.",
          chips: ["Truck", "Reefer", "5,510 kg · 26.4 m³"],
          alert: {
            tone: "warning",
            message: "Plan updated 02:14 · v2 → v3",
            action: "Review",
            href: "/loader/runs/RUN-021",
          },
        },
        {
          code: "RUN-022",
          vehicle_code: "VEH005",
          vehicle_type: "truck",
          temp_capability: "reefer",
          trip_number: 1,
          brand: "fresh",
          district: "Colombo",
          departs_at: at("03:40"),
          status: "ready_to_depart",
          stop_count: 2,
          orders_checked: 4,
          orders_total: 4,
          loader: "Nimal S.",
          chips: ["Truck", "Reefer", "rear_dock 04:00–07:45"],
          alert: {
            tone: "success",
            message: "Signed off · driver can collect",
            action: "View",
            href: "/loader/runs/RUN-022/ready",
          },
        },
        {
          code: "RUN-027",
          vehicle_code: "VEH035",
          vehicle_type: "van",
          temp_capability: "reefer",
          trip_number: 1,
          brand: "fresh",
          district: "Colombo",
          departs_at: at("04:30"),
          status: "issue_flagged",
          stop_count: 3,
          orders_checked: 3,
          orders_total: 5,
          loader: "Tharindu J.",
          chips: ["Van", "Reefer", "van_only"],
          alert: {
            tone: "error",
            message: "ORD0092314 missing · waiting",
            action: "Open",
            href: "/loader/issues/7",
          },
        },
        {
          code: "RUN-029",
          vehicle_code: "VEH005",
          vehicle_type: "truck",
          temp_capability: "reefer",
          trip_number: 2,
          brand: "fresh",
          district: "Colombo",
          departs_at: at("05:20"),
          status: "not_started",
          stop_count: 2,
          orders_checked: 0,
          orders_total: 3,
          loader: null,
          chips: ["Truck", "Reefer", "2nd trip · reload"],
          alert: {
            tone: "neutral",
            message: "Pre-stage ambient pallets at Bay 2",
            action: "Open",
            href: "/loader/runs/RUN-029",
          },
        },
      ],
    },
    {
      label: "Style · day wave",
      brand: "style",
      wave: "day",
      runs: [
        {
          code: "RUN-031",
          vehicle_code: "VEH012",
          vehicle_type: "truck",
          temp_capability: "ambient",
          trip_number: 1,
          brand: "style",
          district: "Colombo",
          departs_at: at("06:00"),
          status: "not_started",
          stop_count: 3,
          orders_checked: 0,
          orders_total: 3,
          loader: null,
          chips: ["Truck", "Ambient", "3,200 kg · 18.0 m³"],
          alert: null,
        },
      ],
    },
    {
      label: "Tech · day wave",
      brand: "tech",
      wave: "day",
      runs: [
        {
          code: "RUN-033",
          vehicle_code: "VEH020",
          vehicle_type: "van",
          temp_capability: "ambient",
          trip_number: 1,
          brand: "tech",
          district: "Gampaha",
          departs_at: at("06:30"),
          status: "not_started",
          stop_count: 2,
          orders_checked: 0,
          orders_total: 2,
          loader: null,
          chips: ["Van", "Ambient", "1,500 kg · 9.0 m³"],
          alert: null,
        },
      ],
    },
  ],
};

// ---- Issues (GET /loader/issues/{id}) ------------------------------------

export const mockIssues: LoaderIssue[] = [
  {
    id: 7,
    run_code: "RUN-027",
    order_number: "ORD0092314",
    outlet_code: "OUT003",
    issue_type: "missing",
    units_affected: 8,
    units_total: 8,
    quick_note_tag: null,
    note: "Chilled order not at the dock.",
    photo_path: null,
    reported_by: "Tharindu J.",
    reported_at: at("02:03"),
    status: "sent",
    seen_at: null,
    decide_by: at("04:10"),
    decided_at: null,
    decided_by: null,
    options: [
      {
        label: "Send without it",
        detail: "Defer to Fri 29 May. OUT003 gets its dry order only.",
        is_default: true,
        is_chosen: false,
      },
      {
        label: "Move to VEH036 · Trip 1",
        detail: "Chilled order follows on the next reefer van.",
        is_default: false,
        is_chosen: false,
      },
      {
        label: "Hold VEH035",
        detail: "Wait for the chiller dock to find it.",
        is_default: false,
        is_chosen: false,
      },
    ],
  },
];
