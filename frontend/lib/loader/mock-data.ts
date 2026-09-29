// Mock data for the loader UI until the /loader API (L0) is ready.
// Scenario follows Figma "02 — Loader": Peliyagoda DC, Dock 3, Fresh night wave,
// RUN-021 after plan v3 was acknowledged.

import type { LoaderDock, LoaderIssue, LoaderUser, Outlet, Run, Vehicle } from "./types";

const DAY = "2026-05-28";
const at = (time: string) => `${DAY}T${time}:00+05:30`;

/** Fixed "now" for the mock scenario, so server and client render the same. */
export const mockNow = at("02:20");

export const mockDock: LoaderDock = {
  dock_code: "PEL-D3",
  name: "Dock 3",
  depot: "Peliyagoda DC",
};

export const mockUsers: LoaderUser[] = [
  { user_id: "LDR-01", full_name: "Saman Jayawardena", initials: "SJ", depot: "Peliyagoda DC" },
  { user_id: "LDR-02", full_name: "Tharindu Jayasuriya", initials: "TJ", depot: "Peliyagoda DC" },
  { user_id: "LDR-03", full_name: "Nimal Silva", initials: "NS", depot: "Peliyagoda DC" },
];

export const mockCurrentUser = mockUsers[0];

const vehicles = {
  VEH001: { vehicle_code: "VEH001", vehicle_type: "truck", is_reefer: true, max_weight_kg: 5510, max_volume_m3: 26.4 },
  VEH005: { vehicle_code: "VEH005", vehicle_type: "truck", is_reefer: true, max_weight_kg: 5510, max_volume_m3: 26.4 },
  VEH035: { vehicle_code: "VEH035", vehicle_type: "van", is_reefer: true, max_weight_kg: 1500, max_volume_m3: 9.0 },
} satisfies Record<string, Vehicle>;

const outlet = (
  outlet_code: string,
  dock_type: Outlet["dock_type"],
  window_start: string,
  window_end: string,
  van_only = false,
): Outlet => ({ outlet_code, brand: "fresh", dock_type, window_start, window_end, van_only });

const RUN_021: Run = {
  run_code: "RUN-021",
  trip_number: 1,
  vehicle: vehicles.VEH001,
  brand: "fresh",
  area: "Gampaha",
  departs_at: at("03:30"),
  status: "loading",
  plan_version: 3,
  plan_updated_at: at("02:14"),
  acknowledged_plan_version: 3,
  acknowledged_by: "Saman J.",
  acknowledged_at: at("02:16"),
  loading_by: ["Saman J."],
  stops: [
    {
      stop_sequence: 1,
      load_position: 5,
      outlet: outlet("OUT028", "street", "03:00", "08:00"),
      eta: at("04:07"),
      note: "deferred yesterday",
      is_new: true,
      orders: [
        {
          order_number: "ORD0092319",
          outlet_code: "OUT028",
          temperature_class: "ambient",
          units: 40,
          weight_kg: 590,
          volume_m3: 2.8,
          load_state: "new",
          note: "New in v3 · nothing loaded has to move",
          changed_in_version: 3,
        },
      ],
    },
    {
      stop_sequence: 2,
      load_position: 4,
      outlet: outlet("OUT026", "rear_dock", "03:00", "08:00"),
      eta: at("04:32"),
      note: "1 dry + 1 chilled",
      orders: [
        {
          order_number: "ORD0092301",
          outlet_code: "OUT026",
          temperature_class: "ambient",
          units: 56,
          weight_kg: 820,
          volume_m3: 4.0,
          load_state: "loaded",
          loaded_units: 53,
          checked_at: at("02:20"),
          checked_by: "Saman J.",
          note: "53 of 56 loaded · 3 damaged, Dispatcher agreed",
        },
        {
          order_number: "ORD0092302",
          outlet_code: "OUT026",
          temperature_class: "chilled",
          units: 46,
          weight_kg: 690,
          volume_m3: 3.2,
          load_state: "to_load",
          note: "Next · pick from chiller dock",
        },
      ],
    },
    {
      stop_sequence: 3,
      load_position: 3,
      outlet: outlet("OUT030", "rear_dock", "03:00", "08:00"),
      eta: at("04:56"),
      orders: [
        {
          order_number: "ORD0092303",
          outlet_code: "OUT030",
          temperature_class: "ambient",
          units: 50,
          weight_kg: 740,
          volume_m3: 3.6,
          load_state: "loaded",
          checked_at: at("02:05"),
          checked_by: "Saman J.",
        },
        {
          order_number: "ORD0092304",
          outlet_code: "OUT030",
          temperature_class: "chilled",
          units: 30,
          weight_kg: 440,
          volume_m3: 2.2,
          load_state: "moved",
          note: "Moved to VEH003 · Trip 1 · 03:45",
          changed_in_version: 3,
        },
      ],
    },
    {
      stop_sequence: 4,
      load_position: 2,
      outlet: outlet("OUT031", "rear_dock", "03:00", "08:00"),
      eta: at("05:20"),
      note: "1 dry + 1 chilled",
      orders: [
        {
          order_number: "ORD0092305",
          outlet_code: "OUT031",
          temperature_class: "ambient",
          units: 48,
          weight_kg: 700,
          volume_m3: 3.4,
          load_state: "loaded",
          checked_at: at("02:26"),
          checked_by: "Saman J.",
          changed_in_version: 3,
        },
        {
          order_number: "ORD0092306",
          outlet_code: "OUT031",
          temperature_class: "chilled",
          units: 34,
          weight_kg: 500,
          volume_m3: 2.4,
          load_state: "loaded",
          checked_at: at("02:26"),
          checked_by: "Saman J.",
          changed_in_version: 3,
        },
      ],
    },
    {
      stop_sequence: 5,
      load_position: 1,
      outlet: outlet("OUT027", "street", "05:00", "07:30"),
      eta: at("05:44"),
      note: "chilled order deferred",
      orders: [
        {
          order_number: "ORD0092307",
          outlet_code: "OUT027",
          temperature_class: "ambient",
          units: 44,
          weight_kg: 650,
          volume_m3: 3.2,
          load_state: "loaded",
          checked_at: at("01:41"),
          checked_by: "Saman J.",
        },
        {
          order_number: "ORD0092308",
          outlet_code: "OUT027",
          temperature_class: "chilled",
          units: 26,
          weight_kg: 380,
          volume_m3: 1.9,
          load_state: "moved",
          note: "Deferred to Fri 29 May · off truck 02:24",
          changed_in_version: 3,
        },
      ],
    },
  ],
};

const RUN_022: Run = {
  run_code: "RUN-022",
  trip_number: 1,
  vehicle: vehicles.VEH005,
  brand: "fresh",
  area: "Colombo",
  departs_at: at("03:40"),
  status: "ready_to_depart",
  plan_version: 1,
  plan_updated_at: at("00:10"),
  acknowledged_plan_version: 1,
  loading_by: ["Nimal S."],
  signed_off_by: "Nimal S.",
  signed_off_at: at("01:48"),
  stops: [
    {
      stop_sequence: 1,
      load_position: 2,
      outlet: outlet("OUT012", "rear_dock", "04:00", "07:45"),
      eta: at("04:15"),
      orders: [
        { order_number: "ORD0092310", outlet_code: "OUT012", temperature_class: "ambient", units: 52, weight_kg: 760, volume_m3: 3.7, load_state: "loaded", checked_at: at("01:20"), checked_by: "Nimal S." },
        { order_number: "ORD0092311", outlet_code: "OUT012", temperature_class: "chilled", units: 30, weight_kg: 450, volume_m3: 2.1, load_state: "loaded", checked_at: at("01:26"), checked_by: "Nimal S." },
      ],
    },
    {
      stop_sequence: 2,
      load_position: 1,
      outlet: outlet("OUT015", "rear_dock", "04:00", "07:45"),
      eta: at("04:50"),
      orders: [
        { order_number: "ORD0092312", outlet_code: "OUT015", temperature_class: "ambient", units: 46, weight_kg: 680, volume_m3: 3.3, load_state: "loaded", checked_at: at("01:08"), checked_by: "Nimal S." },
        { order_number: "ORD0092313", outlet_code: "OUT015", temperature_class: "chilled", units: 28, weight_kg: 410, volume_m3: 1.9, load_state: "loaded", checked_at: at("01:12"), checked_by: "Nimal S." },
      ],
    },
  ],
};

const RUN_027: Run = {
  run_code: "RUN-027",
  trip_number: 1,
  vehicle: vehicles.VEH035,
  brand: "fresh",
  area: "Colombo",
  departs_at: at("04:30"),
  status: "issue_flagged",
  plan_version: 1,
  plan_updated_at: at("00:10"),
  acknowledged_plan_version: 1,
  loading_by: ["Tharindu J."],
  stops: [
    {
      stop_sequence: 1,
      load_position: 3,
      outlet: outlet("OUT041", "street", "05:00", "07:30", true),
      eta: at("05:05"),
      orders: [
        { order_number: "ORD0092314", outlet_code: "OUT041", temperature_class: "chilled", units: 18, weight_kg: 260, volume_m3: 1.2, load_state: "flagged", note: "Missing at the chiller dock · waiting on Dispatcher" },
        { order_number: "ORD0092315", outlet_code: "OUT041", temperature_class: "ambient", units: 22, weight_kg: 310, volume_m3: 1.5, load_state: "to_load" },
      ],
    },
    {
      stop_sequence: 2,
      load_position: 2,
      outlet: outlet("OUT043", "street", "05:00", "07:30", true),
      eta: at("05:40"),
      orders: [
        { order_number: "ORD0092316", outlet_code: "OUT043", temperature_class: "ambient", units: 20, weight_kg: 290, volume_m3: 1.4, load_state: "loaded", checked_at: at("02:30"), checked_by: "Tharindu J." },
      ],
    },
    {
      stop_sequence: 3,
      load_position: 1,
      outlet: outlet("OUT044", "rear_dock", "04:30", "08:00", true),
      eta: at("06:10"),
      orders: [
        { order_number: "ORD0092317", outlet_code: "OUT044", temperature_class: "ambient", units: 24, weight_kg: 340, volume_m3: 1.6, load_state: "loaded", checked_at: at("02:12"), checked_by: "Tharindu J." },
        { order_number: "ORD0092318", outlet_code: "OUT044", temperature_class: "chilled", units: 16, weight_kg: 230, volume_m3: 1.1, load_state: "loaded", checked_at: at("02:16"), checked_by: "Tharindu J." },
      ],
    },
  ],
};

const RUN_029: Run = {
  run_code: "RUN-029",
  trip_number: 2,
  vehicle: vehicles.VEH005,
  brand: "fresh",
  area: "Colombo",
  departs_at: at("05:20"),
  status: "not_started",
  plan_version: 1,
  plan_updated_at: at("00:10"),
  stops: [
    {
      stop_sequence: 1,
      load_position: 2,
      outlet: outlet("OUT018", "rear_dock", "05:30", "08:00"),
      eta: at("05:55"),
      orders: [
        { order_number: "ORD0092320", outlet_code: "OUT018", temperature_class: "ambient", units: 48, weight_kg: 700, volume_m3: 3.4, load_state: "to_load" },
        { order_number: "ORD0092321", outlet_code: "OUT018", temperature_class: "chilled", units: 26, weight_kg: 380, volume_m3: 1.8, load_state: "to_load" },
      ],
    },
    {
      stop_sequence: 2,
      load_position: 1,
      outlet: outlet("OUT019", "street", "05:30", "08:00"),
      eta: at("06:30"),
      orders: [
        { order_number: "ORD0092322", outlet_code: "OUT019", temperature_class: "ambient", units: 36, weight_kg: 530, volume_m3: 2.5, load_state: "to_load" },
      ],
    },
  ],
};

export const mockIssues: LoaderIssue[] = [
  {
    issue_id: "ISS-0141",
    run_code: "RUN-027",
    order_number: "ORD0092314",
    issue_type: "missing",
    status: "seen",
    units_affected: 18,
    note: "Not at the chiller dock",
    reported_by: "Tharindu J.",
    reported_at: at("02:34"),
    decide_by: at("03:04"),
  },
];

export const mockRuns: Run[] = [RUN_021, RUN_022, RUN_027, RUN_029];

export function findMockRun(code: string): Run | undefined {
  return mockRuns.find((run) => run.run_code === code);
}
