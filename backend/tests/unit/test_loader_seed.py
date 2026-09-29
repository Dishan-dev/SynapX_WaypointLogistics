"""The seed script's scenario data must keep matching the design.

These assert the figures quoted in the Figma "data check" frame. If someone
edits the order sizes and the totals stop reconciling, that is a real drift from
the design and these tests are where it surfaces.

The seed's module-level tables are checked directly rather than by running the
script, so no database is needed and nothing can accidentally point at Neon.
"""
import importlib

seed = importlib.import_module("scripts.seed_loader_demo")


def _totals(rows, exclude=()):
    weight = sum(row[4] for row in rows if row[0] not in exclude)
    volume = sum(row[5] for row in rows if row[0] not in exclude)
    return round(weight, 2), round(volume, 2)


def test_run_021_plan_v2_matches_the_design():
    """Eight orders, 4,920 kg / 23.9 m3 - the v2 plan total."""
    v2 = [row for row in seed.RUN_021_ORDERS if row[0] != "ORD0092319"]

    assert len(v2) == 8
    assert _totals(v2) == (4920.0, 23.9)


def test_run_021_plan_v3_matches_the_design():
    """Drop ORD0092308 and ORD0092304, add ORD0092319 -> 4,690 kg / 22.6 m3."""
    v3 = [
        row
        for row in seed.RUN_021_ORDERS
        if row[0] not in ("ORD0092308", "ORD0092304")
    ]

    assert len(v3) == 7
    assert _totals(v3) == (4690.0, 22.6)


def test_adding_out028_without_the_move_would_overflow_the_truck():
    """The design's justification for the swap: 26.7 m3 against a 26.4 m3 limit."""
    v2_volume = _totals([r for r in seed.RUN_021_ORDERS if r[0] != "ORD0092319"])[1]
    new_order_volume = next(
        row[5] for row in seed.RUN_021_ORDERS if row[0] == "ORD0092319"
    )
    veh001_limit = next(v[4] for v in seed.VEHICLES if v[0] == "VEH001")

    assert round(v2_volume + new_order_volume, 2) == 26.7
    assert v2_volume + new_order_volume > veh001_limit


def test_run_027_matches_the_design():
    """Five orders, 727 kg / 5.0 m3; 637 / 4.4 once ORD0092314 moves."""
    assert len(seed.RUN_027_ORDERS) == 5
    assert _totals(seed.RUN_027_ORDERS) == (727.0, 5.0)
    assert _totals(seed.RUN_027_ORDERS, exclude=("ORD0092314",)) == (637.0, 4.4)


def test_loaded_subsets_match_the_in_progress_figures():
    """The t0 check sets reproduce the capacity bars the design shows."""
    loaded_021 = [
        row for row in seed.RUN_021_ORDERS if row[0] in seed.RUN_021_LOADED_AT_T0
    ]
    assert len(loaded_021) == 5
    assert _totals(loaded_021) == (3410.0, 16.6)

    loaded_027 = [
        row for row in seed.RUN_027_ORDERS if row[0] in seed.RUN_027_LOADED_AT_T0
    ]
    assert len(loaded_027) == 3
    assert _totals(loaded_027) == (517.0, 3.6)


def test_vehicle_limits_match_the_csv_quoted_in_the_design():
    limits = {v[0]: (v[1], v[2], v[3], v[4]) for v in seed.VEHICLES}

    assert limits["VEH001"] == ("truck", "reefer", 5510.0, 26.4)
    assert limits["VEH003"] == ("truck", "reefer", 5510.0, 26.4)
    assert limits["VEH005"] == ("truck", "reefer", 6840.0, 33.4)
    assert limits["VEH012"] == ("truck", "ambient", 4200.0, 24.0)
    assert limits["VEH014"] == ("truck", "ambient", 7200.0, 38.0)
    assert limits["VEH035"] == ("van", "reefer", 1040.0, 7.0)
    assert limits["VEH036"] == ("van", "reefer", 1040.0, 7.0)


def test_chilled_orders_only_ride_on_reefers():
    capability = {v[0]: v[2] for v in seed.VEHICLES}

    for vehicle_code, rows in (
        ("VEH001", seed.RUN_021_ORDERS),
        ("VEH035", seed.RUN_027_ORDERS),
    ):
        if any(row[2] == "chilled" for row in rows):
            assert capability[vehicle_code] == "reefer", vehicle_code


def test_van_only_outlets_are_served_by_a_van():
    van_only = {o[0] for o in seed.OUTLETS if o[5]}
    run_027_outlets = {row[1] for row in seed.RUN_027_ORDERS}
    run_021_outlets = {row[1] for row in seed.RUN_021_ORDERS}
    vehicle_type = {v[0]: v[1] for v in seed.VEHICLES}

    # RUN-027 serves van_only outlets, so it must be on a van.
    assert run_027_outlets & van_only
    assert vehicle_type["VEH035"] == "van"
    # RUN-021 is a truck, so none of its outlets may be van_only.
    assert not (run_021_outlets & van_only)


def test_each_run_is_one_brand_and_one_district():
    outlets = {o[0]: (o[2], o[3]) for o in seed.OUTLETS}

    for rows in (seed.RUN_021_ORDERS, seed.RUN_027_ORDERS):
        brands = {outlets[row[1]][0] for row in rows}
        districts = {outlets[row[1]][1] for row in rows}
        assert len(brands) == 1
        assert len(districts) == 1


def _minutes_between(earlier: str, later: str) -> float:
    return (seed.at(later) - seed.at(earlier)).total_seconds() / 60


def test_run_021_etas_follow_the_gampaha_travel_and_handling_method():
    """Gampaha: 37 min out, then each stop's handling plus 9 min between stops."""
    stops = seed.RUN_021_V2_STOPS

    assert _minutes_between("03:30", stops[0][2]) == 37

    for previous, current in zip(stops, stops[1:]):
        gap = _minutes_between(previous[2], current[2])
        assert gap == previous[3] + 9, f"{previous[1]} -> {current[1]}"


def test_run_027_first_stop_waits_for_the_outlet_window_to_open():
    """Colombo is 24 min out, which lands at 04:54 - before OUT001 opens at 05:00."""
    stops = seed.RUN_027_STOPS
    windows = {o[0]: o[6] for o in seed.OUTLETS}

    unclamped = _minutes_between("04:30", "04:54")
    assert unclamped == 24
    assert windows["OUT001"] == "05:00"
    assert stops[0][2] == "05:00"

    for previous, current in zip(stops, stops[1:]):
        gap = _minutes_between(previous[2], current[2])
        assert gap == previous[3] + 8, f"{previous[1]} -> {current[1]}"


def test_v3_pushes_every_gampaha_stop_back_by_the_new_stops_cost():
    """Inserting OUT028 ahead of OUT026 shifts the run by 25 minutes.

    The design's v3 checklist shows OUT026 at 04:32; v2 has it at 04:07.
    """
    out028_handling = 16  # street
    shift = out028_handling + 9  # handling plus travel to the next stop

    v2_out026 = next(s[2] for s in seed.RUN_021_V2_STOPS if s[1] == "OUT026")
    assert _minutes_between(v2_out026, "04:32") == shift


def test_calendar_day_is_the_operating_day_from_the_design():
    assert seed.DAY.isoformat() == "2026-05-28"
