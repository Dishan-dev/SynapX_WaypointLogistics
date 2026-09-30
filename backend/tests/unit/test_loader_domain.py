"""Domain rules behind the loader checklist, plan changes and decisions."""
import pytest

from app.core.exceptions import InvalidStateTransitionError, NotFoundError
from app.models.delivery_run import RunOrderState, RunStatus
from app.models.loader_issue import IssueStatus
from app.models.plan_revision import PlanChangeKind
from app.schemas import loader as schemas
from app.services.loader_service import LoaderService
from tests.conftest_loader import at, build_run_021, make_issue, make_loader, put_on_truck


def test_stops_are_returned_in_load_order_not_delivery_order(db_session):
    """The loader works the truck from the cab out, the reverse of the driver's route."""
    run, _ = build_run_021(db_session)

    stops = LoaderService.current_stops(db_session, run)

    assert [s.outlet.code for s in stops] == ["OUT027", "OUT031", "OUT030", "OUT026"]
    assert [s.load_position for s in stops] == [1, 2, 3, 4]
    # The last stop to be delivered is the first to be loaded.
    assert [s.stop_sequence for s in stops] == [4, 3, 2, 1]


def test_run_detail_capacity_matches_the_design(db_session):
    run, _ = build_run_021(db_session)

    detail = LoaderService.build_run_detail(db_session, run)

    assert detail.capacity.planned_weight_kg == 4920.0
    assert detail.capacity.planned_volume_m3 == 23.9
    assert detail.capacity.loaded_weight_kg == 3410.0
    assert detail.capacity.loaded_volume_m3 == 16.6
    assert detail.capacity.max_weight_kg == 5510.0
    assert detail.capacity.max_volume_m3 == 26.4
    assert (detail.orders_checked, detail.orders_total) == (5, 8)


def test_plan_change_applies_the_three_kinds_of_change(db_session):
    run, _ = build_run_021(db_session)
    put_on_truck(db_session, run, "ORD0092308")

    revision = LoaderService.simulate_plan_change(
        db_session,
        run,
        schemas.SimulatedPlanChangeRequest(
            unload_order_numbers=["ORD0092308"],
            dont_load_order_numbers=["ORD0092304"],
            load_new_order_numbers=["ORD0092319"],
        ),
    )

    assert revision.version == 3
    assert run.current_plan_version == 3

    kinds = {
        change.order.order_number: change.change_kind.value for change in revision.changes
    }
    assert kinds == {
        "ORD0092308": "unload_from_truck",
        "ORD0092304": "dont_load",
        "ORD0092319": "load_new",
    }


def test_plan_change_reaches_the_designs_v3_totals(db_session):
    run, _ = build_run_021(db_session)

    LoaderService.simulate_plan_change(
        db_session,
        run,
        schemas.SimulatedPlanChangeRequest(
            unload_order_numbers=["ORD0092308"],
            dont_load_order_numbers=["ORD0092304"],
            load_new_order_numbers=["ORD0092319"],
        ),
    )
    detail = LoaderService.build_run_detail(db_session, run)

    assert detail.capacity.planned_weight_kg == 4690.0
    assert detail.capacity.planned_volume_m3 == 22.6
    # Seven orders left to deal with; the two off-plan rows are not counted.
    assert detail.orders_total == 7


def test_new_outlet_becomes_the_first_stop_and_loads_last(db_session):
    """A stop added by the dispatcher is delivered first, so it goes in by the door."""
    run, _ = build_run_021(db_session)

    LoaderService.simulate_plan_change(
        db_session,
        run,
        schemas.SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"]),
    )
    detail = LoaderService.build_run_detail(db_session, run)

    by_outlet = {stop.outlet.code: stop for stop in detail.stops}
    assert by_outlet["OUT028"].stop_sequence == 1
    assert by_outlet["OUT028"].load_position == 5
    # The existing stops shift down the route but keep their relative order.
    assert by_outlet["OUT026"].stop_sequence == 2
    assert by_outlet["OUT027"].stop_sequence == 5
    assert by_outlet["OUT027"].load_position == 1
    # Delivery order and load order stay exact mirrors of each other.
    for stop in detail.stops:
        assert stop.load_position == len(detail.stops) - stop.stop_sequence + 1


def _states(db_session, run):
    detail = LoaderService.build_run_detail(db_session, run)
    return detail, {
        order.order_number: order.state
        for stop in detail.stops
        for order in stop.orders
    }


def test_only_the_named_orders_need_rechecking_after_a_plan_change(db_session):
    """Figma 2a: 0092305/06 were moved to reach 0092308; 0092307 stays on."""
    run, _ = build_run_021(db_session)
    put_on_truck(db_session, run, "ORD0092308")

    LoaderService.simulate_plan_change(
        db_session,
        run,
        schemas.SimulatedPlanChangeRequest(
            unload_order_numbers=["ORD0092308"],
            recheck_order_numbers=["ORD0092305", "ORD0092306"],
        ),
    )
    detail, states = _states(db_session, run)

    assert states["ORD0092305"] == RunOrderState.RE_CHECK
    assert states["ORD0092306"] == RunOrderState.RE_CHECK
    assert states["ORD0092307"] == RunOrderState.LOADED
    assert states["ORD0092301"] == RunOrderState.LOADED
    assert states["ORD0092308"] == RunOrderState.TAKE_OFF
    # Kept checks still count; the two re-checks do not until confirmed.
    assert detail.orders_checked == 3


def test_without_a_recheck_list_every_order_aboard_is_rechecked(db_session):
    """The safe fallback when the dispatcher does not say which ones moved."""
    run, _ = build_run_021(db_session)
    put_on_truck(db_session, run, "ORD0092308")

    LoaderService.simulate_plan_change(
        db_session,
        run,
        schemas.SimulatedPlanChangeRequest(unload_order_numbers=["ORD0092308"]),
    )
    detail, states = _states(db_session, run)

    assert states["ORD0092307"] == RunOrderState.RE_CHECK
    assert states["ORD0092308"] == RunOrderState.TAKE_OFF
    # Re-check is not resolved, so review stays locked.
    assert detail.orders_checked == 0


def test_an_unload_of_an_order_still_in_staging_is_a_dont_load(db_session):
    run, _ = build_run_021(db_session)

    revision = LoaderService.simulate_plan_change(
        db_session,
        run,
        schemas.SimulatedPlanChangeRequest(unload_order_numbers=["ORD0092308"]),
    )
    _, states = _states(db_session, run)

    assert states["ORD0092308"] == RunOrderState.MOVED
    assert [c.change_kind for c in revision.changes] == [PlanChangeKind.DONT_LOAD]


def test_a_dont_load_of_an_order_aboard_is_an_unload(db_session):
    run, _ = build_run_021(db_session)

    revision = LoaderService.simulate_plan_change(
        db_session,
        run,
        schemas.SimulatedPlanChangeRequest(dont_load_order_numbers=["ORD0092307"]),
    )
    _, states = _states(db_session, run)

    assert states["ORD0092307"] == RunOrderState.TAKE_OFF
    assert [c.change_kind for c in revision.changes] == [PlanChangeKind.UNLOAD_FROM_TRUCK]


def test_an_outstanding_take_off_survives_the_next_version(db_session):
    """Stacked changes never drop a task: v3's take-off is still there in v4."""
    run, _ = build_run_021(db_session)
    put_on_truck(db_session, run, "ORD0092308")
    LoaderService.simulate_plan_change(
        db_session, run,
        schemas.SimulatedPlanChangeRequest(
            unload_order_numbers=["ORD0092308"], recheck_order_numbers=["ORD0092305"],
        ),
    )

    LoaderService.simulate_plan_change(
        db_session, run,
        # Nothing had to move for v4: an empty list keeps every check.
        schemas.SimulatedPlanChangeRequest(
            dont_load_order_numbers=["ORD0092302"], recheck_order_numbers=[],
        ),
    )
    _, states = _states(db_session, run)

    assert states["ORD0092308"] == RunOrderState.TAKE_OFF
    assert states["ORD0092305"] == RunOrderState.RE_CHECK
    assert states["ORD0092307"] == RunOrderState.LOADED
    assert states["ORD0092302"] == RunOrderState.MOVED


def test_re_adding_an_order_still_aboard_asks_for_a_re_check(db_session):
    run, _ = build_run_021(db_session)
    put_on_truck(db_session, run, "ORD0092308")
    LoaderService.simulate_plan_change(
        db_session, run, schemas.SimulatedPlanChangeRequest(unload_order_numbers=["ORD0092308"])
    )

    revision = LoaderService.simulate_plan_change(
        db_session, run, schemas.SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092308"])
    )
    _, states = _states(db_session, run)

    assert states["ORD0092308"] == RunOrderState.RE_CHECK
    assert [c.change_kind for c in revision.changes] == [PlanChangeKind.LOAD_NEW]


def test_re_adding_a_dropped_order_makes_it_new_again(db_session):
    run, _ = build_run_021(db_session)
    LoaderService.simulate_plan_change(
        db_session, run, schemas.SimulatedPlanChangeRequest(dont_load_order_numbers=["ORD0092304"])
    )

    LoaderService.simulate_plan_change(
        db_session, run, schemas.SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092304"])
    )
    _, states = _states(db_session, run)

    assert states["ORD0092304"] == RunOrderState.NEW


def test_the_dispatchers_reasons_are_stored_per_order(db_session):
    run, _ = build_run_021(db_session)

    revision = LoaderService.simulate_plan_change(
        db_session,
        run,
        schemas.SimulatedPlanChangeRequest(
            dont_load_order_numbers=["ORD0092304"],
            reasons={"ORD0092304": "VEH003's loader already has it."},
        ),
    )

    assert [c.reason for c in revision.changes] == ["VEH003's loader already has it."]


def test_plan_change_leaves_the_revision_unacknowledged(db_session):
    run, _ = build_run_021(db_session)

    LoaderService.simulate_plan_change(
        db_session, run, schemas.SimulatedPlanChangeRequest(load_new_order_numbers=[])
    )
    detail = LoaderService.build_run_detail(db_session, run)

    assert detail.unacknowledged_plan_version == 3
    assert detail.plan.acknowledged_at is None


def test_plan_change_is_refused_after_the_run_leaves_the_gate(db_session):
    run, _ = build_run_021(db_session)
    run.status = RunStatus.GATED_OUT

    with pytest.raises(InvalidStateTransitionError):
        LoaderService.simulate_plan_change(
            db_session, run, schemas.SimulatedPlanChangeRequest()
        )


def test_a_plan_change_reopens_a_ready_run(db_session):
    """Figma 2d: Ready -> Loading, and the release time is kept for "was Ready"."""
    run, _ = build_run_021(db_session)
    run.status = RunStatus.READY_TO_DEPART
    run.released_at = at("01:48")

    LoaderService.simulate_plan_change(
        db_session, run, schemas.SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"])
    )

    assert run.status == RunStatus.LOADING
    assert run.released_at == at("01:48")
    events = [entry.type for entry in LoaderService.list_activity(db_session, run)]
    assert events == ["load_reopened", "plan_published"]


def test_a_plan_change_takes_a_loaded_run_back_to_loading(db_session):
    run, _ = build_run_021(db_session)
    run.status = RunStatus.LOADED

    LoaderService.simulate_plan_change(
        db_session, run, schemas.SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"])
    )

    assert run.status == RunStatus.LOADING


def test_a_plan_change_leaves_an_issue_flagged_run_alone(db_session):
    """issue_flagged clears when the issue is decided, not when the plan changes."""
    run, _ = build_run_021(db_session)
    run.status = RunStatus.ISSUE_FLAGGED

    LoaderService.simulate_plan_change(
        db_session, run, schemas.SimulatedPlanChangeRequest(load_new_order_numbers=["ORD0092319"])
    )

    assert run.status == RunStatus.ISSUE_FLAGGED


def test_decision_removing_the_order_frees_capacity_and_unlocks_release(db_session):
    run, orders = build_run_021(db_session)
    run.status = RunStatus.ISSUE_FLAGGED
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)

    LoaderService.simulate_decision(
        db_session,
        issue,
        schemas.SimulatedDecisionRequest(option_label="Move to VEH036 · Trip 1"),
    )

    assert issue.status == IssueStatus.DECIDED
    assert [o.label for o in issue.options if o.is_chosen] == ["Move to VEH036 · Trip 1"]
    # ORD0092308 is 380 kg / 1.9 m3 of the 4,920 / 23.9 plan.
    assert run.planned_weight_kg == 4540.0
    assert run.planned_volume_m3 == 22.0
    # Nothing left waiting, so the run can be released again.
    assert run.status == RunStatus.LOADING


def test_holding_the_van_keeps_the_order_aboard(db_session):
    run, orders = build_run_021(db_session)
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)

    LoaderService.simulate_decision(
        db_session, issue, schemas.SimulatedDecisionRequest(option_label="Hold VEH035")
    )

    # Holding only delays departure; the order stays on the plan.
    assert run.planned_weight_kg == 4920.0


def test_timeout_applies_the_default_option(db_session):
    run, orders = build_run_021(db_session)
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)

    LoaderService.simulate_decision_timeout(db_session, issue)

    assert issue.status == IssueStatus.DEFAULT_APPLIED
    assert [o.label for o in issue.options if o.is_chosen] == ["Send without it"]
    assert "decide-by" in issue.decided_by


def test_a_settled_issue_cannot_be_decided_again(db_session):
    run, orders = build_run_021(db_session)
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)
    LoaderService.simulate_decision_timeout(db_session, issue)

    with pytest.raises(InvalidStateTransitionError):
        LoaderService.simulate_decision(
            db_session, issue, schemas.SimulatedDecisionRequest(option_label="Hold VEH035")
        )


def test_unknown_option_is_rejected(db_session):
    run, orders = build_run_021(db_session)
    reporter = make_loader(db_session, "Tharindu Jayasuriya", "Tharindu J.")
    issue = make_issue(db_session, run, orders["ORD0092308"], reporter)

    with pytest.raises(NotFoundError):
        LoaderService.simulate_decision(
            db_session, issue, schemas.SimulatedDecisionRequest(option_label="Nope")
        )


def test_missing_run_raises_not_found(db_session):
    with pytest.raises(NotFoundError):
        LoaderService.get_run(db_session, "RUN-999")
