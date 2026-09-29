"""Business logic behind the loader endpoints.

Endpoints stay thin; anything that decides something lives here.
"""
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import InvalidStateTransitionError, NotFoundError
from app.models.delivery_run import (
    DeliveryRun,
    RunOrderState,
    RunStatus,
    RunStop,
    RunStopOrder,
    StopStatus,
)
from app.models.loader_activity import ActorKind, CheckAction, LoaderActivity, LoadingCheck
from app.models.loader_issue import IssueStatus, IssueType, LoaderIssue, LoaderIssueOption
from app.models.loader_user import LoaderSession, LoaderUser
from app.models.order import Order
from app.models.plan_revision import PlanChangeKind, PlanRevision, PlanRevisionChange
from app.models.reference import Dock, TemperatureClass
from app.schemas import loader as schemas

# States that mean the order is physically aboard, for the capacity rollup.
# RE_CHECK counts: the goods are on the truck, they just need re-confirming
# against the new plan.
ON_TRUCK_STATES = {RunOrderState.LOADED, RunOrderState.RE_CHECK}

# States that no longer need the loader to act, for the "checked or flagged"
# gate that unlocks review. RE_CHECK is deliberately NOT resolved - a plan change
# invalidates the earlier check, and the loader has to confirm it again.
RESOLVED_STATES = {RunOrderState.LOADED, RunOrderState.FLAGGED}

# States where the order has left this run's plan. Still rendered on the
# checklist (greyed, or as a pinned unload task), but not counted in the
# "x of y" totals - they are no longer orders to load.
OFF_PLAN_STATES = {RunOrderState.TAKE_OFF, RunOrderState.MOVED}

# Once signed off or through the gate, the checklist is closed to the loader.
# Reopening after Ready is L7's plan-change path, not a plain check.
CLOSED_RUN_STATES = {RunStatus.READY_TO_DEPART, RunStatus.GATED_OUT}

# Which row states each tablet action may start from. check also clears
# re_check: the tablet taps the same tile whatever the row says, so a check on a
# re_check row confirms it exactly as recheck does.
ORDER_ACTIONS = {
    CheckAction.CHECK: {RunOrderState.TO_LOAD, RunOrderState.NEW, RunOrderState.RE_CHECK},
    CheckAction.RECHECK: {RunOrderState.RE_CHECK},
    CheckAction.UNCHECK: {RunOrderState.LOADED},
    # take_off -> moved: the order is off the truck and off this run. There is
    # no separate "unloaded" state; the loading_checks row records the unload.
    CheckAction.UNLOAD: {RunOrderState.TAKE_OFF},
}

# Rows already where the action would put them. These are a 200 no-op, not an
# error: two loaders can tick the same order, and the second tap should not
# bounce. Nothing is recorded, since nothing changed.
ALREADY_DONE = {
    CheckAction.CHECK: {RunOrderState.LOADED},
    CheckAction.RECHECK: {RunOrderState.LOADED},
    CheckAction.UNCHECK: {RunOrderState.TO_LOAD, RunOrderState.NEW},
    CheckAction.UNLOAD: {RunOrderState.MOVED},
}

ACTION_EVENTS = {
    CheckAction.CHECK: ("order_checked", "loaded"),
    CheckAction.RECHECK: ("order_rechecked", "re-checked"),
    CheckAction.UNCHECK: ("order_unchecked", "unchecked"),
    CheckAction.UNLOAD: ("order_unloaded", "off truck"),
}


class StalePlanVersionError(InvalidStateTransitionError):
    """The tablet acted on a plan version the dispatcher has since replaced.

    Subclasses InvalidStateTransitionError so the existing 409 handler serves
    it; only the code and details differ.
    """

    def __init__(self, run: DeliveryRun, sent_version: int):
        super().__init__(
            f"Plan changed to v{run.current_plan_version}; this action was made on "
            f"v{sent_version}.",
            current_state=f"v{run.current_plan_version}",
            target_state=f"v{sent_version}",
            entity="DeliveryRun",
        )
        self.code = "PLAN_VERSION_STALE"
        self.details = {
            "entity": "DeliveryRun",
            "entity_id": run.code,
            "current_plan_version": run.current_plan_version,
            "sent_plan_version": sent_version,
        }


class PlanNotAcknowledgedError(InvalidStateTransitionError):
    """A row write on a plan version nobody has acknowledged yet.

    The tablet shows the plan-change takeover until the loader acknowledges;
    this is the server's side of that, so a tablet that missed the takeover
    still cannot check against a plan it never read.
    """

    def __init__(self, run: DeliveryRun):
        super().__init__(
            f"Plan v{run.current_plan_version} has not been acknowledged; read the change first.",
            current_state=f"v{run.current_plan_version} unacknowledged",
            target_state="acknowledged",
            entity="DeliveryRun",
        )
        self.code = "PLAN_NOT_ACKNOWLEDGED"
        self.details = {
            "entity": "DeliveryRun",
            "entity_id": run.code,
            "unacknowledged_plan_version": run.current_plan_version,
        }


# Undo of a release (L6): the tablet shows a 10 s undo; the server allows 2 s
# more so a tap on the last second, sent over a slow link, still lands.
UNDO_WINDOW_SECONDS = 10
UNDO_GRACE_SECONDS = 2


def _utc_z(value: datetime) -> str:
    """A datetime as the API writes it, for error details (which are plain JSON)."""
    return _naive_utc(value).isoformat() + "Z"


class ReleaseLockedError(InvalidStateTransitionError):
    """POST /release while something still blocks it (L6).

    detail.release_blockers is the same [{code, count}] list the run read and
    release-summary send, so the tablet can say why without another request.
    """

    def __init__(self, run: DeliveryRun, blockers: List[schemas.ReleaseBlockerRead]):
        super().__init__(
            f"{run.code} cannot be released yet.",
            current_state="locked",
            target_state="ready_to_depart",
            entity="DeliveryRun",
        )
        self.code = "RELEASE_LOCKED"
        self.details = {
            "entity": "DeliveryRun",
            "entity_id": run.code,
            "release_blockers": [b.model_dump() for b in blockers],
        }


class UndoWindowExpiredError(InvalidStateTransitionError):
    """POST /release/undo after the undo window has closed (L6)."""

    def __init__(self, run: DeliveryRun):
        super().__init__(
            f"The undo window for {run.code} has closed.",
            current_state=run.status.value,
            target_state="undo",
            entity="DeliveryRun",
        )
        self.code = "UNDO_WINDOW_EXPIRED"
        self.details = {
            "entity": "DeliveryRun",
            "entity_id": run.code,
            "released_at": _utc_z(run.released_at),
            "window_seconds": UNDO_WINDOW_SECONDS,
        }


class ClientActionIdReusedError(InvalidStateTransitionError):
    """A client_action_id already recorded for a different order or action.

    A genuine replay always repeats the same request, so a mismatch is a client
    bug; answering it with the other action's result would hide that.
    """

    def __init__(self, client_action_id: str, entity: str = "LoadingCheck"):
        super().__init__(
            f"client_action_id {client_action_id} was already used for a different action.",
            current_state="used",
            target_state="reused",
            entity=entity,
        )
        self.code = "CLIENT_ACTION_ID_REUSED"
        self.details = {"entity": entity, "client_action_id": client_action_id}


class LoaderService:
    # --- reads ------------------------------------------------------------

    @staticmethod
    def get_run(db: Session, code: str) -> DeliveryRun:
        run = db.execute(select(DeliveryRun).filter_by(code=code)).scalars().first()
        if run is None:
            raise NotFoundError(f"Run '{code}' not found.", entity="DeliveryRun", entity_id=code)
        return run

    @staticmethod
    def get_issue(db: Session, issue_id: int) -> LoaderIssue:
        issue = db.get(LoaderIssue, issue_id)
        if issue is None:
            raise NotFoundError(
                f"Issue '{issue_id}' not found.", entity="LoaderIssue", entity_id=issue_id
            )
        return issue

    @staticmethod
    def current_stops(db: Session, run: DeliveryRun) -> List[RunStop]:
        """Stops for the run's current plan version, in LOADING order.

        Sorted by load_position, which is the reverse of the delivery sequence -
        the last stop is loaded first, deepest against the cab.
        """
        return list(
            db.execute(
                select(RunStop)
                .filter_by(run_id=run.id, plan_version=run.current_plan_version)
                .order_by(RunStop.load_position)
            ).scalars()
        )

    @staticmethod
    def build_run_detail(db: Session, run: DeliveryRun) -> schemas.RunDetailRead:
        stops = LoaderService.current_stops(db, run)
        issues = LoaderService._latest_issues(db, run)
        unloads = LoaderService._unloads(db, run)
        diff = LoaderService._plan_diff(db, run, stops, unloads)
        blockers = LoaderService.release_blockers(db, run)

        stop_reads: List[schemas.RunStopRead] = []
        loaded = 0
        checked = 0
        total = 0
        for stop in stops:
            order_reads = []
            for row in sorted(stop.orders, key=lambda r: r.order.order_number):
                if row.state not in OFF_PLAN_STATES:
                    total += 1
                    if row.state == RunOrderState.LOADED:
                        loaded += 1
                    if row.state in RESOLVED_STATES:
                        checked += 1
                unload = unloads.get(row.order_id) if row.state == RunOrderState.MOVED else None
                order_reads.append(
                    schemas.RunOrderRead(
                        order_number=row.order.order_number,
                        temperature_class=row.order.temperature_class,
                        units=row.units,
                        weight_kg=row.weight_kg,
                        volume_m3=row.volume_m3,
                        state=row.state,
                        checked_at=row.checked_at,
                        checked_by=row.checked_by.short_name if row.checked_by else None,
                        loaded_units=LoaderService.loaded_units(row, issues.get(row.order_id)),
                        unloaded_at=unload.at if unload else None,
                        unloaded_by=unload.actor.short_name if unload and unload.actor else None,
                        **(diff.order_fields(row, stop) if diff else {}),
                    )
                )
            stop_reads.append(
                schemas.RunStopRead(
                    stop_sequence=stop.stop_sequence,
                    load_position=stop.load_position,
                    eta=stop.eta,
                    handling_minutes=stop.handling_minutes,
                    status=stop.status,
                    outlet=schemas.OutletRead.model_validate(stop.outlet),
                    orders=order_reads,
                    **(diff.stop_fields(stop) if diff else {}),
                )
            )

        revision = LoaderService.get_revision(db, run, run.current_plan_version)
        plan_read = None
        unacknowledged = None
        if revision is not None:
            plan_read = schemas.PlanRevisionRead(
                version=revision.version,
                published_at=revision.published_at,
                source=revision.source,
                summary=revision.summary,
                acknowledged_at=revision.acknowledged_at,
                acknowledged_by=(
                    revision.acknowledged_by.short_name if revision.acknowledged_by else None
                ),
            )
            if revision.acknowledged_at is None:
                unacknowledged = revision.version

        return schemas.RunDetailRead(
            code=run.code,
            trip_number=run.trip_number,
            brand=run.brand,
            district=run.district,
            wave=run.wave,
            departs_at=run.departs_at,
            status=run.status,
            **LoaderService.release_fields(run),
            current_plan_version=run.current_plan_version,
            dock=run.dock.name,
            vehicle=schemas.VehicleRead.model_validate(run.vehicle),
            capacity=schemas.CapacityRead(
                loaded_weight_kg=run.loaded_weight_kg,
                planned_weight_kg=run.planned_weight_kg,
                max_weight_kg=run.vehicle.max_weight_kg,
                loaded_volume_m3=run.loaded_volume_m3,
                planned_volume_m3=run.planned_volume_m3,
                max_volume_m3=run.vehicle.max_volume_m3,
            ),
            plan=plan_read,
            unacknowledged_plan_version=unacknowledged,
            acknowledged_plan_version=db.execute(
                select(func.max(PlanRevision.version)).where(
                    PlanRevision.run_id == run.id,
                    PlanRevision.acknowledged_at.is_not(None),
                )
            ).scalar(),
            plan_change=diff.summary(db, run, stops) if diff else None,
            stops=stop_reads,
            orders_loaded=loaded,
            orders_checked=checked,
            orders_total=total,
            release_locked=bool(blockers),
            release_blockers=blockers,
        )

    @staticmethod
    def loaded_units(row: RunStopOrder, issue: Optional[LoaderIssue]) -> int:
        """Units of this order actually on the truck.

        - loaded, re_check, take_off (not yet unloaded): every unit is aboard.
        - flagged: missing -> 0; short, damaged or won't fit -> units minus the
          units flagged (a flag without a count takes nothing off).
        - to_load, new, moved: nothing aboard.
        """
        units = row.units or 0
        if row.state in (RunOrderState.LOADED, RunOrderState.RE_CHECK, RunOrderState.TAKE_OFF):
            return units
        if row.state == RunOrderState.FLAGGED and issue is not None:
            if issue.issue_type == IssueType.MISSING:
                return 0
            return max(units - (issue.units_affected or 0), 0)
        return 0

    @staticmethod
    def _latest_issues(db: Session, run: DeliveryRun) -> dict:
        """The most recent issue per order on this run, by order id."""
        issues = db.execute(
            select(LoaderIssue)
            .filter_by(run_id=run.id)
            .order_by(LoaderIssue.reported_at, LoaderIssue.id)
        ).scalars().all()
        return {issue.order_id: issue for issue in issues}

    @staticmethod
    def release_fields(run: DeliveryRun) -> dict:
        """released_at / released_by as the API sends them, for the run read and
        the queue card alike.

        Only while the run is signed off (ready_to_depart or gated_out). The
        column keeps the time after a plan change reopens the run, for "was
        Ready 01:48", but the run is not released any more, so the API says so.
        """
        if run.status not in CLOSED_RUN_STATES or run.released_at is None:
            return {"released_at": None, "released_by": None}
        who = run.released_by
        return {
            "released_at": run.released_at,
            "released_by": (
                schemas.LoaderRefRead(id=who.id, name=who.short_name) if who else None
            ),
        }

    @staticmethod
    def check_release_allowed(db: Session, run: DeliveryRun) -> None:
        """For POST /release (L6): raise 409 RELEASE_LOCKED, with the blockers
        in the detail, unless nothing blocks the release."""
        blockers = LoaderService.release_blockers(db, run)
        if blockers:
            raise ReleaseLockedError(run, blockers)

    @staticmethod
    def check_undo_allowed(run: DeliveryRun, now: Optional[datetime] = None) -> None:
        """For POST /release/undo (L6).

        Only a run that is still ready_to_depart can be undone - a plan change
        inside the window has already reopened it, and after gate-out it is the
        Driver's. Then only within UNDO_WINDOW_SECONDS of released_at, plus
        UNDO_GRACE_SECONDS; after that, 409 UNDO_WINDOW_EXPIRED.
        """
        if run.status != RunStatus.READY_TO_DEPART or run.released_at is None:
            raise InvalidStateTransitionError(
                f"{run.code} is {run.status.value}; only a ready_to_depart run can be undone.",
                current_state=run.status.value,
                target_state="undo",
                entity="DeliveryRun",
            )
        now = now or datetime.now(timezone.utc)
        elapsed = (_naive_utc(now) - _naive_utc(run.released_at)).total_seconds()
        if elapsed > UNDO_WINDOW_SECONDS + UNDO_GRACE_SECONDS:
            raise UndoWindowExpiredError(run)

    @staticmethod
    def release_blockers(db: Session, run: DeliveryRun) -> List[schemas.ReleaseBlockerRead]:
        """Everything that must be done before the run can be released.

        Empty means release is allowed. Checked by the read so the button can
        say why it is locked ("Release locked · unload first"), and meant to be
        checked again by POST /release (L6) before it writes anything.

        take_off rows are outside orders_total, so "all checked" alone would
        let a truck leave with an order the plan took off; unload_pending is
        what stops that.
        """
        states = LoaderService._current_states(db, run)
        blockers: List[schemas.ReleaseBlockerRead] = []

        def add(code: str, count: int) -> None:
            if count:
                blockers.append(schemas.ReleaseBlockerRead(code=code, count=count))

        current = LoaderService.get_revision(db, run, run.current_plan_version)
        add("plan_not_acknowledged", int(current is not None and current.acknowledged_at is None))
        add("unload_pending", states.count(RunOrderState.TAKE_OFF))
        add("re_check_pending", states.count(RunOrderState.RE_CHECK))
        add("orders_open", states.count(RunOrderState.TO_LOAD) + states.count(RunOrderState.NEW))
        add(
            "issue_waiting",
            len(
                db.execute(
                    select(LoaderIssue.id).where(
                        LoaderIssue.run_id == run.id,
                        LoaderIssue.status.in_([IssueStatus.SENT, IssueStatus.SEEN]),
                    )
                ).all()
            ),
        )
        return blockers

    @staticmethod
    def _plan_diff(
        db: Session, run: DeliveryRun, stops: List[RunStop], unloads: dict
    ) -> Optional["PlanDiff"]:
        """The latest change as one diff, or None when there is nothing to compare.

        The window is the versions the latest acknowledgement covers - every
        version still unread, or, once read, every version acknowledged in that
        same tap. The base is the version just before it: what the loader had
        confirmed before this change. So v2 -> v3 -> v4 unread reads as v2 -> v4,
        and after the acknowledgement the checklist keeps showing that diff.

        None when the base has no stops on record (a run seeded straight at v2).
        """
        revisions = {
            r.version: r
            for r in db.execute(select(PlanRevision).filter_by(run_id=run.id)).scalars()
        }
        current = revisions.get(run.current_plan_version)
        if current is None:
            return None

        first = current.version
        while first - 1 in revisions and (
            revisions[first - 1].acknowledged_at == current.acknowledged_at
        ):
            first -= 1
        base = first - 1

        base_stops = db.execute(
            select(RunStop).filter_by(run_id=run.id, plan_version=base)
        ).scalars().all()
        if not base_stops:
            return None

        window = [revisions[v] for v in range(first, current.version + 1) if v in revisions]
        versions = [r.version for r in window]

        changes = db.execute(
            select(PlanRevisionChange)
            .join(PlanRevision, PlanRevisionChange.revision_id == PlanRevision.id)
            .where(PlanRevision.run_id == run.id, PlanRevision.version.in_(versions))
            .order_by(PlanRevision.version, PlanRevisionChange.position, PlanRevisionChange.id)
        ).scalars().all()

        # A check confirms a re_check row just as recheck does (the tablet only
        # sends check), so both count; PlanDiff keeps the ones on orders that
        # were aboard before the change.
        rechecks = db.execute(
            select(LoadingCheck)
            .join(RunStopOrder, LoadingCheck.run_stop_order_id == RunStopOrder.id)
            .join(RunStop, RunStopOrder.run_stop_id == RunStop.id)
            .where(
                RunStop.run_id == run.id,
                LoadingCheck.action.in_([CheckAction.CHECK, CheckAction.RECHECK]),
                LoadingCheck.plan_version.in_(versions),
            )
            .order_by(LoadingCheck.at, LoadingCheck.id)
        ).scalars().all()

        return PlanDiff(
            base_version=base,
            window=window,
            base_stops=base_stops,
            changes=changes,
            rechecked={c.run_stop_order.order_id: c.plan_version for c in rechecks},
            unloaded_in_window={
                order_id for order_id, check in unloads.items() if check.plan_version in versions
            },
            current_stops=stops,
        )

    @staticmethod
    def _unloads(db: Session, run: DeliveryRun) -> dict:
        """The latest UNLOAD check per order on this run, by order id."""
        checks = db.execute(
            select(LoadingCheck)
            .join(RunStopOrder, LoadingCheck.run_stop_order_id == RunStopOrder.id)
            .join(RunStop, RunStopOrder.run_stop_id == RunStop.id)
            .where(RunStop.run_id == run.id, LoadingCheck.action == CheckAction.UNLOAD)
            .order_by(LoadingCheck.at, LoadingCheck.id)
        ).scalars().all()
        return {c.run_stop_order.order_id: c for c in checks}

    @staticmethod
    def build_issue_detail(db: Session, issue: LoaderIssue) -> schemas.IssueDetailRead:
        options = sorted(issue.options, key=lambda o: o.position)
        return schemas.IssueDetailRead(
            id=issue.id,
            run_code=issue.run.code,
            order_number=issue.order.order_number,
            outlet_code=issue.order.outlet.code if issue.order.outlet else None,
            issue_type=issue.issue_type,
            units_affected=issue.units_affected,
            units_total=issue.units_total,
            quick_note_tag=issue.quick_note_tag,
            note=issue.note,
            photo_path=issue.photo_path,
            reported_by=issue.reported_by.short_name,
            reported_at=issue.reported_at,
            status=issue.status,
            seen_at=issue.seen_at,
            decide_by=issue.decide_by,
            decided_at=issue.decided_at,
            decided_by=issue.decided_by,
            options=[
                schemas.IssueOptionRead(
                    label=o.label,
                    detail=o.detail,
                    is_default=o.is_default,
                    is_chosen=o.is_chosen,
                )
                for o in options
            ],
        )

    @staticmethod
    def _to_activity_read(row: LoaderActivity) -> schemas.ActivityRead:
        return schemas.ActivityRead(
            at=row.at,
            run_code=row.run.code,
            actor_kind=row.actor_kind,
            actor=row.actor_label or (row.actor.short_name if row.actor else None),
            event_type=row.event_type,
            order_number=row.order.order_number if row.order else None,
            message=row.message,
        )

    @staticmethod
    def list_activity(db: Session, run: DeliveryRun) -> List[schemas.ActivityRead]:
        """One run's timeline, OLDEST first.

        The Change log panel reads top to bottom as the shift progresses
        (02:14 published -> 02:16 acknowledged -> 02:20 ...), so chronological
        order is what the design wants here.
        """
        rows = db.execute(
            select(LoaderActivity)
            .filter_by(run_id=run.id)
            .order_by(LoaderActivity.at, LoaderActivity.id)
        ).scalars()
        return [LoaderService._to_activity_read(row) for row in rows]

    @staticmethod
    def resolve_dock(db: Session, dock: str) -> Dock:
        """Find a dock by number ("3"), code ("DOCK3") or name ("Dock 3")."""
        needle = (dock or "").strip()
        if not needle:
            raise NotFoundError("No dock given.", entity="Dock", entity_id=dock)

        candidates = [needle, needle.upper().replace(" ", "")]
        if needle.isdigit():
            candidates += [f"DOCK{needle}", f"Dock {needle}"]

        for candidate in candidates:
            found = db.execute(
                select(Dock).where(
                    (Dock.code == candidate) | (Dock.name == candidate)
                )
            ).scalars().first()
            if found is not None:
                return found

        raise NotFoundError(f"Dock '{dock}' not found.", entity="Dock", entity_id=dock)

    @staticmethod
    def list_dock_activity(
        db: Session,
        dock: Dock,
        run_code: Optional[str] = None,
        limit: int = 100,
    ) -> List[schemas.ActivityRead]:
        """Everything that happened at one dock, NEWEST first.

        This is a feed rather than a timeline - the loader coming back to the Log
        tab wants the most recent thing at the top, across every run on the dock.
        That is the opposite of the per-run timeline above, deliberately.

        `run_code` narrows the feed to one run without changing the ordering.
        """
        query = (
            select(LoaderActivity)
            .join(DeliveryRun, LoaderActivity.run_id == DeliveryRun.id)
            .where(DeliveryRun.dock_id == dock.id)
        )

        if run_code is not None:
            run = LoaderService.get_run(db, run_code)
            if run.dock_id != dock.id:
                raise NotFoundError(
                    f"Run '{run_code}' is not at {dock.name}.",
                    entity="DeliveryRun",
                    entity_id=run_code,
                )
            query = query.where(LoaderActivity.run_id == run.id)

        rows = db.execute(
            query.order_by(LoaderActivity.at.desc(), LoaderActivity.id.desc()).limit(limit)
        ).scalars()
        return [LoaderService._to_activity_read(row) for row in rows]

    # --- writes from the tablet -------------------------------------------

    @staticmethod
    def apply_order_action(
        db: Session,
        run_code: str,
        order_number: str,
        action: CheckAction,
        payload: schemas.OrderActionRequest,
    ) -> DeliveryRun:
        """Check, uncheck or re-check one checklist row. Returns the run.

        Order matters:

        1. Replay first. A client_action_id already in loading_checks means this
           tap was applied before, so nothing is applied again. It comes before
           the stale-plan check on purpose: a check accepted under v2 and
           replayed after v3 is published must still answer 200, not 409.
        2. Stale plan: refuse a tap made against an older plan version, and
           any tap while the current version is still unacknowledged.
        3. Transition the row, then roll the change up into stop, run,
           capacity and the activity log - all in one savepoint, so a racing
           replay of the same id loses on the unique constraint instead of
           writing twice.
        """
        run = LoaderService.get_run(db, run_code)
        action_id = str(payload.client_action_id)

        if LoaderService._is_replay(db, run, order_number, action, action_id):
            return run

        if payload.plan_version != run.current_plan_version:
            raise StalePlanVersionError(run, payload.plan_version)

        # Serialise writers on this run so two tablets cannot race the run
        # status rollup. A no-op on SQLite, which has no row locks.
        db.execute(select(DeliveryRun.id).where(DeliveryRun.id == run.id).with_for_update())

        if run.status in CLOSED_RUN_STATES:
            raise InvalidStateTransitionError(
                f"{run.code} is {run.status.value}; the checklist is closed.",
                current_state=run.status.value,
                target_state=action.value,
                entity="DeliveryRun",
            )

        current = LoaderService.get_revision(db, run, run.current_plan_version)
        if current is not None and current.acknowledged_at is None:
            raise PlanNotAcknowledgedError(run)

        row = LoaderService._current_row(db, run, order_number)
        if row.state in ALREADY_DONE[action]:
            return run
        target = LoaderService._target_state(db, run, row, action)
        if row.state not in ORDER_ACTIONS[action]:
            raise InvalidStateTransitionError(
                f"{order_number} is {row.state.value}; it cannot be {action.value}ed.",
                current_state=row.state.value,
                target_state=target.value,
                entity="RunStopOrder",
            )

        actor = LoaderService._session_actor(db, payload.loader_session_id)
        now = datetime.now(timezone.utc)

        try:
            with db.begin_nested():
                db.add(
                    LoadingCheck(
                        run_stop_order_id=row.id,
                        action=action,
                        actor_id=actor.id if actor else None,
                        at=now,
                        client_action_id=action_id,
                        plan_version=run.current_plan_version,
                    )
                )
                was_re_check = row.state == RunOrderState.RE_CHECK
                row.state = target
                if target == RunOrderState.LOADED:
                    row.checked_at = now
                    row.checked_by_id = actor.id if actor else None
                else:
                    row.checked_at = None
                    row.checked_by_id = None
                db.flush()

                LoaderService.refresh_stop_status(row.run_stop)
                LoaderService.recalculate_capacity(db, run)
                LoaderService._refresh_run_status(db, run)

                # The log says what happened to the row: a check that clears
                # re_check is a re-check. loading_checks keeps the verb sent,
                # which is what a replay is matched against.
                logged_as = CheckAction.RECHECK if was_re_check else action
                event_type, verb = ACTION_EVENTS[logged_as]
                message = f"{order_number} {verb}"
                if action == CheckAction.UNLOAD:
                    message += f", back in {LoaderService.return_area(row.order)}"
                LoaderService.log(
                    db, run, at=now, actor_kind=ActorKind.LOADER,
                    event_type=event_type, actor_id=actor.id if actor else None,
                    order_id=row.order_id, message=message,
                )
                db.flush()
        except IntegrityError:
            # The same id landed between our lookup and our insert. The savepoint
            # has rolled back our copy; the other one is the original.
            if LoaderService._is_replay(db, run, order_number, action, action_id):
                db.refresh(run)
                return run
            raise

        return run

    @staticmethod
    def _find_loading_check(db: Session, action_id: str) -> Optional[LoadingCheck]:
        return db.execute(
            select(LoadingCheck).filter_by(client_action_id=action_id)
        ).scalars().first()

    @staticmethod
    def _is_replay(
        db: Session, run: DeliveryRun, order_number: str, action: CheckAction, action_id: str
    ) -> bool:
        """True if this exact tap was already applied; raises if the id was reused."""
        existing = LoaderService._find_loading_check(db, action_id)
        if existing is None:
            return False
        previous = existing.run_stop_order
        if (
            existing.action != action
            or previous.run_stop.run_id != run.id
            or previous.order.order_number != order_number
        ):
            raise ClientActionIdReusedError(action_id)
        return True

    @staticmethod
    def _current_row(db: Session, run: DeliveryRun, order_number: str) -> RunStopOrder:
        row = db.execute(
            select(RunStopOrder)
            .join(RunStop, RunStopOrder.run_stop_id == RunStop.id)
            .join(Order, RunStopOrder.order_id == Order.id)
            .where(
                RunStop.run_id == run.id,
                RunStop.plan_version == run.current_plan_version,
                Order.order_number == order_number,
            )
        ).scalars().first()
        if row is None:
            raise NotFoundError(
                f"Order '{order_number}' is not on {run.code} plan v{run.current_plan_version}.",
                entity="RunStopOrder",
                entity_id=order_number,
            )
        return row

    @staticmethod
    def _target_state(
        db: Session, run: DeliveryRun, row: RunStopOrder, action: CheckAction
    ) -> RunOrderState:
        if action == CheckAction.UNLOAD:
            return RunOrderState.MOVED
        if action != CheckAction.UNCHECK:
            return RunOrderState.LOADED
        # Unchecking returns the row to how the plan introduced it: an order the
        # current version added goes back to "new", not "to load".
        added_now = db.execute(
            select(PlanRevisionChange.id)
            .join(PlanRevision, PlanRevisionChange.revision_id == PlanRevision.id)
            .where(
                PlanRevision.run_id == run.id,
                PlanRevision.version == run.current_plan_version,
                PlanRevisionChange.change_kind == PlanChangeKind.LOAD_NEW,
                PlanRevisionChange.order_id == row.order_id,
            )
        ).first()
        return RunOrderState.NEW if added_now else RunOrderState.TO_LOAD

    @staticmethod
    def _session_actor(db: Session, session_id: Optional[int]) -> Optional[LoaderUser]:
        """The loader signed in when the tap happened.

        An ended session is still accepted: an offline tap is often replayed
        after the idle timeout has signed that loader out.
        """
        if session_id is None:
            return None
        session = db.get(LoaderSession, session_id)
        if session is None:
            raise NotFoundError(
                f"Loader session {session_id} not found.",
                entity="LoaderSession",
                entity_id=session_id,
            )
        return session.loader_user

    @staticmethod
    def acknowledge_plan(
        db: Session,
        run_code: str,
        version: int,
        payload: schemas.AcknowledgePlanRequest,
    ) -> DeliveryRun:
        """The loader has read the plan-change diff. Returns the run.

        Same order as apply_order_action: replay first, then the stale-plan
        check, then the write in a savepoint.

        Stacked changes are confirmed once: acknowledging v4 while v3 is also
        unread stamps both, because the loader read them as one diff (v2 -> v4).
        The client_action_id goes on the version named in the path only; the
        column is unique, and that is the revision the tap was for.
        """
        run = LoaderService.get_run(db, run_code)
        action_id = str(payload.client_action_id)

        existing = db.execute(
            select(PlanRevision).filter_by(client_action_id=action_id)
        ).scalars().first()
        if existing is not None:
            if existing.run_id == run.id and existing.version == version:
                return run
            raise ClientActionIdReusedError(action_id, entity="PlanRevision")

        if version != run.current_plan_version:
            raise StalePlanVersionError(run, version)

        db.execute(select(DeliveryRun.id).where(DeliveryRun.id == run.id).with_for_update())

        if run.status == RunStatus.GATED_OUT:
            raise InvalidStateTransitionError(
                f"{run.code} has left the gate; plan changes go to the Driver.",
                current_state=run.status.value,
                target_state="acknowledged",
                entity="DeliveryRun",
            )

        revision = LoaderService.get_revision(db, run, version)
        if revision is None:
            raise NotFoundError(
                f"{run.code} has no plan v{version}.", entity="PlanRevision", entity_id=version
            )
        # Someone else already acknowledged it (another tablet, another id).
        if revision.acknowledged_at is not None:
            return run

        actor = LoaderService._session_actor(db, payload.loader_session_id)
        now = datetime.now(timezone.utc)
        unread = db.execute(
            select(PlanRevision).where(
                PlanRevision.run_id == run.id,
                PlanRevision.version <= version,
                PlanRevision.acknowledged_at.is_(None),
            )
        ).scalars().all()

        try:
            with db.begin_nested():
                for rev in unread:
                    rev.acknowledged_at = now
                    rev.acknowledged_by_id = actor.id if actor else None
                revision.client_action_id = action_id
                # TODO(L2): loader_session_id becomes required; drop "unknown loader".
                who = actor.full_name if actor else "unknown loader"
                LoaderService.log(
                    db, run, at=now, actor_kind=ActorKind.LOADER,
                    event_type="plan_acknowledged", actor_id=actor.id if actor else None,
                    message=f"Plan v{version} received · {who}",
                )
                db.flush()
        except IntegrityError:
            replay = db.execute(
                select(PlanRevision).filter_by(client_action_id=action_id)
            ).scalars().first()
            if replay is not None and replay.run_id == run.id and replay.version == version:
                db.refresh(run)
                return run
            raise

        return run

    @staticmethod
    def return_area(order: Order) -> str:
        """Where an unloaded order goes back to: chilled to the chiller dock."""
        return "chiller" if order.temperature_class == TemperatureClass.CHILLED else "staging"

    @staticmethod
    def refresh_stop_status(stop: RunStop) -> None:
        """complete when every active order is loaded or flagged, loading when
        any is aboard or resolved, otherwise pending. The seed uses this too."""
        active = [r for r in stop.orders if r.state not in OFF_PLAN_STATES]
        if active and all(r.state in RESOLVED_STATES for r in active):
            stop.status = StopStatus.COMPLETE
        elif any(r.state in RESOLVED_STATES | ON_TRUCK_STATES for r in active):
            stop.status = StopStatus.LOADING
        else:
            stop.status = StopStatus.PENDING

    @staticmethod
    def _refresh_run_status(db: Session, run: DeliveryRun) -> None:
        """not_started -> loading -> loaded, and back to loading on an uncheck.

        issue_flagged is left alone: it clears when the issue is decided (L8),
        not when rows change. A run never returns to not_started once touched.
        """
        if run.status == RunStatus.ISSUE_FLAGGED:
            return
        checked, total = LoaderService.progress(db, run)
        run.status = RunStatus.LOADED if total and checked == total else RunStatus.LOADING

    # --- helpers ----------------------------------------------------------

    @staticmethod
    def progress(db: Session, run: DeliveryRun) -> Tuple[int, int]:
        """(orders_checked, orders_total) for the current plan - the review gate."""
        active = [s for s in LoaderService._current_states(db, run) if s not in OFF_PLAN_STATES]
        return sum(1 for s in active if s in RESOLVED_STATES), len(active)

    @staticmethod
    def _current_states(db: Session, run: DeliveryRun) -> List[RunOrderState]:
        """Every row's state on the current plan version."""
        return list(
            db.execute(
                select(RunStopOrder.state)
                .join(RunStop, RunStopOrder.run_stop_id == RunStop.id)
                .where(
                    RunStop.run_id == run.id,
                    RunStop.plan_version == run.current_plan_version,
                )
            ).scalars()
        )

    @staticmethod
    def get_revision(db: Session, run: DeliveryRun, version: int) -> Optional[PlanRevision]:
        return db.execute(
            select(PlanRevision).filter_by(run_id=run.id, version=version)
        ).scalars().first()

    @staticmethod
    def recalculate_capacity(db: Session, run: DeliveryRun) -> None:
        """Recompute planned and loaded totals from the current plan's rows."""
        rows = db.execute(
            select(RunStopOrder)
            .join(RunStop, RunStopOrder.run_stop_id == RunStop.id)
            .where(
                RunStop.run_id == run.id,
                RunStop.plan_version == run.current_plan_version,
            )
        ).scalars().all()

        planned_w = planned_v = loaded_w = loaded_v = 0.0
        for row in rows:
            # An order taken off the plan is not part of what the run should carry.
            if row.state in (RunOrderState.TAKE_OFF, RunOrderState.MOVED):
                continue
            planned_w += row.weight_kg or 0.0
            planned_v += row.volume_m3 or 0.0
            if row.state in ON_TRUCK_STATES:
                loaded_w += row.weight_kg or 0.0
                loaded_v += row.volume_m3 or 0.0

        run.planned_weight_kg = round(planned_w, 2)
        run.planned_volume_m3 = round(planned_v, 2)
        run.loaded_weight_kg = round(loaded_w, 2)
        run.loaded_volume_m3 = round(loaded_v, 2)

    @staticmethod
    def log(
        db: Session,
        run: DeliveryRun,
        *,
        at: datetime,
        actor_kind: ActorKind,
        event_type: str,
        message: str,
        actor_label: Optional[str] = None,
        actor_id: Optional[int] = None,
        order_id: Optional[int] = None,
    ) -> LoaderActivity:
        entry = LoaderActivity(
            run_id=run.id,
            at=at,
            actor_kind=actor_kind,
            actor_id=actor_id,
            actor_label=actor_label,
            event_type=event_type,
            order_id=order_id,
            message=message,
        )
        db.add(entry)
        return entry

    # --- publishing a plan ------------------------------------------------

    @staticmethod
    def publish_plan(
        db: Session,
        run: DeliveryRun,
        *,
        unload: List[str],
        dont_load: List[str],
        load_new: List[str],
        recheck: Optional[List[str]] = None,
        reasons: Optional[Dict[str, str]] = None,
        summary: Optional[str] = None,
        source: str = "Dispatcher",
    ) -> PlanRevision:
        """Publish the next plan version for a run.

        Copies the current version's stops and rows forward, applies the three
        kinds of change, and leaves the revision unacknowledged so the checklist
        blocks until the loader reads it.

        What happens to each row:

        - unload / dont_load follow where the order actually is, whichever list
          it came in: aboard -> take_off (it has to come back off), still in
          staging -> moved. The change is recorded under the kind that applied.
        - recheck names the loaded orders the loader must re-confirm - the ones
          moved to reach an order coming off (Figma 2a: ORD0092305/06). Every
          other check is kept. With recheck=None, every order aboard is put to
          re_check, the safe default when nobody said which ones moved.
        - A load_new order already on the run is re-added in place: re_check if
          it is still aboard (a take_off nobody unloaded yet), new otherwise.
        - take_off and re_check rows are carried forward as they are, so a
          stacked change never loses an outstanding task or a check.
        - reasons are the dispatcher's words per order, shown in the diff.

        The dev plan-change endpoint is the only caller today; the dispatcher's
        real publish is meant to call this too, so every rule about what a new
        version does to the run lives here and not in the simulation.
        """
        if run.status == RunStatus.GATED_OUT:
            raise InvalidStateTransitionError(
                "The run has already left the gate; plan changes are the driver's problem now.",
                current_state=run.status.value,
                target_state="plan_changed",
                entity="DeliveryRun",
            )

        old_version = run.current_plan_version
        new_version = old_version + 1

        unload = set(unload)
        dont_load = set(dont_load)
        load_new = list(load_new)
        recheck = None if recheck is None else set(recheck)
        readded = set(load_new)
        readded_rows: set = set()
        # (kind, order number) as actually applied, for the change records.
        applied: List[Tuple[PlanChangeKind, str]] = []

        old_stops = sorted(
            db.execute(
                select(RunStop).filter_by(run_id=run.id, plan_version=old_version)
            ).scalars(),
            key=lambda s: s.stop_sequence,
        )

        # Resolve the incoming orders first, so the final stop sequence can be
        # assigned in one pass. Renumbering existing stops afterwards would
        # collide with uq_run_stop_sequence partway through the UPDATE.
        new_orders: List[Order] = []
        for number in load_new:
            order = db.execute(
                select(Order).filter_by(order_number=number)
            ).scalars().first()
            if order is None:
                raise NotFoundError(
                    f"Order '{number}' not found.", entity="Order", entity_id=number
                )
            new_orders.append(order)

        existing_outlet_ids = {s.outlet_id for s in old_stops}
        prepended_outlet_ids: List[int] = []
        for order in new_orders:
            if (
                order.outlet_id is not None
                and order.outlet_id not in existing_outlet_ids
                and order.outlet_id not in prepended_outlet_ids
            ):
                prepended_outlet_ids.append(order.outlet_id)

        # A brand new stop goes first in delivery order, so it loads last -
        # nearest the door, first off the truck.
        offset = len(prepended_outlet_ids)
        total_stops = len(old_stops) + offset

        def load_position_for(sequence: int) -> int:
            return total_stops - sequence + 1

        carried: List[RunStop] = []
        for index, outlet_id in enumerate(prepended_outlet_ids):
            sequence = index + 1
            new_stop = RunStop(
                run_id=run.id,
                plan_version=new_version,
                stop_sequence=sequence,
                load_position=load_position_for(sequence),
                outlet_id=outlet_id,
                eta=None,
                handling_minutes=None,
            )
            db.add(new_stop)
            db.flush()
            carried.append(new_stop)

        # Copy each existing stop and its rows forward into the new version.
        for old_stop in old_stops:
            sequence = old_stop.stop_sequence + offset
            new_stop = RunStop(
                run_id=run.id,
                plan_version=new_version,
                stop_sequence=sequence,
                load_position=load_position_for(sequence),
                outlet_id=old_stop.outlet_id,
                eta=old_stop.eta,
                handling_minutes=old_stop.handling_minutes,
                status=old_stop.status,
            )
            db.add(new_stop)
            db.flush()
            for old_row in old_stop.orders:
                number = old_row.order.order_number
                if number in unload or number in dont_load:
                    if old_row.state in ON_TRUCK_STATES | {RunOrderState.TAKE_OFF}:
                        # On the truck: it has to physically come back off.
                        state = RunOrderState.TAKE_OFF
                        applied.append((PlanChangeKind.UNLOAD_FROM_TRUCK, number))
                    else:
                        # Never left staging, so it is simply dropped.
                        state = RunOrderState.MOVED
                        applied.append((PlanChangeKind.DONT_LOAD, number))
                elif number in readded:
                    readded_rows.add(number)
                    if old_row.state in OFF_PLAN_STATES:
                        # Back on the plan: still aboard (never unloaded) needs a
                        # re-check, otherwise it is loaded like any new order.
                        state = (
                            RunOrderState.RE_CHECK
                            if old_row.state == RunOrderState.TAKE_OFF
                            else RunOrderState.NEW
                        )
                        applied.append((PlanChangeKind.LOAD_NEW, number))
                    else:
                        state = old_row.state  # already on the plan
                elif old_row.state == RunOrderState.LOADED and (
                    recheck is None or number in recheck
                ):
                    state = RunOrderState.RE_CHECK
                else:
                    state = old_row.state
                db.add(
                    RunStopOrder(
                        run_stop_id=new_stop.id,
                        order_id=old_row.order_id,
                        plan_version=new_version,
                        state=state,
                        units=old_row.units,
                        weight_kg=old_row.weight_kg,
                        volume_m3=old_row.volume_m3,
                        checked_at=old_row.checked_at,
                        checked_by_id=old_row.checked_by_id,
                    )
                )
            carried.append(new_stop)

        # Attach the incoming orders to their stop, new or existing.
        for order in new_orders:
            if order.order_number in readded_rows:
                continue
            applied.append((PlanChangeKind.LOAD_NEW, order.order_number))
            stop = next((s for s in carried if s.outlet_id == order.outlet_id), None)
            if stop is None:
                raise NotFoundError(
                    f"No stop on {run.code} serves order '{order.order_number}'.",
                    entity="RunStop",
                    entity_id=order.order_number,
                )
            db.add(
                RunStopOrder(
                    run_stop_id=stop.id,
                    order_id=order.id,
                    plan_version=new_version,
                    state=RunOrderState.NEW,
                    units=order.units,
                    weight_kg=order.weight_kg,
                    volume_m3=order.volume_m3,
                )
            )

        run.current_plan_version = new_version
        db.flush()
        LoaderService.recalculate_capacity(db, run)

        now = datetime.now(timezone.utc)
        revision = PlanRevision(
            run_id=run.id,
            version=new_version,
            published_at=now,
            source=source,
            summary=summary or f"Plan v{old_version} -> v{new_version}",
            planned_weight_kg=run.planned_weight_kg,
            planned_volume_m3=run.planned_volume_m3,
        )
        db.add(revision)
        db.flush()

        # The diff's three groups, in the order the takeover shows them.
        groups = [PlanChangeKind.UNLOAD_FROM_TRUCK, PlanChangeKind.DONT_LOAD, PlanChangeKind.LOAD_NEW]
        for kind, number in sorted(applied, key=lambda a: (groups.index(a[0]), a[1])):
            order = db.execute(
                select(Order).filter_by(order_number=number)
            ).scalars().first()
            db.add(
                PlanRevisionChange(
                    revision_id=revision.id,
                    change_kind=kind,
                    order_id=order.id if order else None,
                    outlet_id=order.outlet_id if order else None,
                    reason=(reasons or {}).get(number),
                    position=groups.index(kind),
                )
            )

        LoaderService.log(
            db, run, at=now, actor_kind=ActorKind.DISPATCHER,
            event_type="plan_published", actor_label=source,
            message=f"{source} published plan v{new_version}",
        )

        # A new plan reopens a signed-off load: the loader acknowledges, works
        # the diff and releases again. released_at is kept so the reopen screen
        # can say "was Ready 01:48"; the next release overwrites it.
        if run.status == RunStatus.READY_TO_DEPART:
            run.status = RunStatus.LOADING
            LoaderService.log(
                db, run, at=now, actor_kind=ActorKind.SYSTEM,
                event_type="load_reopened", actor_label="System",
                message=f"Load reopened · plan changed after Ready · v{old_version} -> v{new_version}",
            )
        elif run.status == RunStatus.LOADED:
            LoaderService._refresh_run_status(db, run)
        db.flush()
        return revision

    # --- dev-only simulation ---------------------------------------------

    @staticmethod
    def simulate_plan_change(
        db: Session,
        run: DeliveryRun,
        payload: schemas.SimulatedPlanChangeRequest,
    ) -> PlanRevision:
        """Publish the next plan version, as the dispatcher would."""
        return LoaderService.publish_plan(
            db,
            run,
            unload=payload.unload_order_numbers or [],
            dont_load=payload.dont_load_order_numbers or [],
            load_new=payload.load_new_order_numbers or [],
            recheck=payload.recheck_order_numbers,
            reasons=payload.reasons,
            summary=payload.summary,
        )

    @staticmethod
    def simulate_decision(
        db: Session,
        issue: LoaderIssue,
        payload: schemas.SimulatedDecisionRequest,
    ) -> LoaderIssue:
        """Apply a dispatcher decision to a waiting issue."""
        if issue.status in (IssueStatus.DECIDED, IssueStatus.DEFAULT_APPLIED):
            raise InvalidStateTransitionError(
                "This issue has already been resolved.",
                current_state=issue.status.value,
                target_state="decided",
                entity="LoaderIssue",
            )

        options = {o.label: o for o in issue.options}
        label = payload.option_label
        if label is None:
            chosen = next((o for o in issue.options if o.is_default), None)
        else:
            chosen = options.get(label)
            if chosen is None:
                raise NotFoundError(
                    f"Option '{label}' is not on issue {issue.id}.",
                    entity="LoaderIssueOption",
                    entity_id=label,
                )
        if chosen is None:
            raise NotFoundError(
                f"Issue {issue.id} has no default option to apply.",
                entity="LoaderIssueOption",
                entity_id=issue.id,
            )

        now = datetime.now(timezone.utc)
        for option in issue.options:
            option.is_chosen = option is chosen
        issue.status = IssueStatus.DECIDED
        issue.decided_at = now
        issue.decided_by = payload.decided_by
        if issue.seen_at is None:
            issue.seen_at = now

        LoaderService._apply_issue_outcome(db, issue, chosen)
        LoaderService.log(
            db, issue.run, at=now, actor_kind=ActorKind.DISPATCHER,
            event_type="issue_decided", actor_label=payload.decided_by,
            order_id=issue.order_id,
            message=f"{issue.order.order_number}: {chosen.label}",
        )
        db.flush()
        return issue

    @staticmethod
    def simulate_decision_timeout(db: Session, issue: LoaderIssue) -> LoaderIssue:
        """Apply the pre-agreed default because decide-by passed."""
        if issue.status in (IssueStatus.DECIDED, IssueStatus.DEFAULT_APPLIED):
            raise InvalidStateTransitionError(
                "This issue has already been resolved.",
                current_state=issue.status.value,
                target_state="default_applied",
                entity="LoaderIssue",
            )

        chosen = next((o for o in issue.options if o.is_default), None)
        if chosen is None:
            raise NotFoundError(
                f"Issue {issue.id} has no default option to apply.",
                entity="LoaderIssueOption",
                entity_id=issue.id,
            )

        now = datetime.now(timezone.utc)
        for option in issue.options:
            option.is_chosen = option is chosen
        issue.status = IssueStatus.DEFAULT_APPLIED
        issue.decided_at = now
        issue.decided_by = "System (decide-by passed)"

        LoaderService._apply_issue_outcome(db, issue, chosen)
        LoaderService.log(
            db, issue.run, at=now, actor_kind=ActorKind.SYSTEM,
            event_type="issue_default_applied", actor_label="System",
            order_id=issue.order_id,
            message=f"No decision by decide-by; applied default: {chosen.label}",
        )
        db.flush()
        return issue

    @staticmethod
    def _apply_issue_outcome(
        db: Session, issue: LoaderIssue, chosen: LoaderIssueOption
    ) -> None:
        """Take the flagged order off the run when the decision removes it.

        "Send without it" and "Move to ..." both mean the order stops being this
        run's problem; "Hold ..." keeps it aboard and only delays departure.
        """
        label = chosen.label.lower()
        removes_order = label.startswith("send without") or label.startswith("move to")

        if removes_order:
            row = db.execute(
                select(RunStopOrder)
                .join(RunStop, RunStopOrder.run_stop_id == RunStop.id)
                .where(
                    RunStop.run_id == issue.run_id,
                    RunStop.plan_version == issue.run.current_plan_version,
                    RunStopOrder.order_id == issue.order_id,
                )
            ).scalars().first()
            if row is not None:
                row.state = RunOrderState.MOVED
            LoaderService.recalculate_capacity(db, issue.run)

        # With nothing left waiting, the run can be released again.
        outstanding = db.execute(
            select(LoaderIssue).where(
                LoaderIssue.run_id == issue.run_id,
                LoaderIssue.status.in_([IssueStatus.SENT, IssueStatus.SEEN]),
                LoaderIssue.id != issue.id,
            )
        ).scalars().first()
        if outstanding is None and issue.run.status == RunStatus.ISSUE_FLAGGED:
            issue.run.status = RunStatus.LOADING


def _naive_utc(value: datetime) -> datetime:
    """Compare stored (naive UTC) and fresh (aware UTC) datetimes safely."""
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


class PlanDiff:
    """The latest plan change read against the plan before it.

    Built by LoaderService._plan_diff; this only turns it into the extra fields
    on the checklist read. Which group an order is in follows where the order
    is NOW, not only what each version said, so stacked changes collapse:
    added in v3 and dropped again in v4 before loading is no change at all.
    """

    def __init__(
        self,
        *,
        base_version: int,
        window: List[PlanRevision],
        base_stops: List[RunStop],
        changes: List[PlanRevisionChange],
        rechecked: dict,
        unloaded_in_window: set,
        current_stops: List[RunStop],
    ):
        self.base_version = base_version
        self.window = window
        self.to_version = window[-1].version
        self.base_sequence = {s.outlet_id: s.stop_sequence for s in base_stops}
        self.base_rows = {row.order_id: row for s in base_stops for row in s.orders}
        # Latest change per order across the window: the dispatcher's words.
        self.changes = {c.order_id: c for c in changes if c.order_id is not None}
        # Re-confirmed in this change: checked again while it was already aboard.
        self.rechecked = {
            order_id: version
            for order_id, version in rechecked.items()
            if order_id in self.base_rows and self.base_rows[order_id].state in ON_TRUCK_STATES
        }
        self.unloaded = unloaded_in_window
        # Orders coming off the truck, with their stop's load position, so a
        # re-check row can say which order it was moved to reach.
        self.coming_off = [
            (stop.load_position, row.order.order_number)
            for stop in current_stops
            for row in stop.orders
            if self._is_unload(row)
        ]

    def _is_unload(self, row: RunStopOrder) -> bool:
        return row.state == RunOrderState.TAKE_OFF or (
            row.state == RunOrderState.MOVED and row.order_id in self.unloaded
        )

    def _kind(self, row: RunStopOrder) -> Optional[PlanChangeKind]:
        base = self.base_rows.get(row.order_id)
        was_on_plan = base is not None and base.state not in OFF_PLAN_STATES
        if self._is_unload(row):
            return PlanChangeKind.UNLOAD_FROM_TRUCK
        if row.state == RunOrderState.MOVED:
            return PlanChangeKind.DONT_LOAD if was_on_plan else None
        if not was_on_plan:
            return PlanChangeKind.LOAD_NEW
        return None

    def order_fields(self, row: RunStopOrder, stop: RunStop) -> dict:
        kind = self._kind(row)
        if kind is not None:
            change = self.changes.get(row.order_id)
            note = None
            if row.state == RunOrderState.TAKE_OFF:
                note = "Take off the truck"
            elif kind == PlanChangeKind.UNLOAD_FROM_TRUCK:
                note = f"Off truck · back in {LoaderService.return_area(row.order)}"
            return {
                "change_kind": kind,
                "changed_in_version": change.revision.version if change else self.to_version,
                "reason": change.reason if change else None,
                "note": note,
            }
        if row.state == RunOrderState.RE_CHECK:
            reach = sorted(n for position, n in self.coming_off if position < stop.load_position)
            return {
                "changed_in_version": self.to_version,
                "note": (
                    f"Re-check · moved to reach {', '.join(reach)}"
                    if reach else "Re-check · plan changed"
                ),
            }
        if row.state == RunOrderState.LOADED and row.order_id in self.rechecked:
            return {"changed_in_version": self.rechecked[row.order_id]}
        return {}

    def stop_fields(self, stop: RunStop) -> dict:
        before = self.base_sequence.get(stop.outlet_id)
        if before is None:
            return {"note": "new stop", "is_new": True}
        if before != stop.stop_sequence:
            return {"note": f"was Stop {before}"}
        return {}

    def summary(self, db: Session, run: DeliveryRun, stops: List[RunStop]) -> schemas.PlanDiffRead:
        latest = self.window[-1]
        before = [r for r in self.base_rows.values() if r.state not in OFF_PLAN_STATES]

        # "was Ready 01:48" only when this change is what reopened the run.
        published = _naive_utc(self.window[0].published_at)
        reopened = any(
            _naive_utc(entry.at) >= published
            for entry in db.execute(
                select(LoaderActivity).filter_by(run_id=run.id, event_type="load_reopened")
            ).scalars()
        )
        was_ready_at = (
            run.released_at
            if reopened and run.released_at and run.status not in CLOSED_RUN_STATES
            else None
        )

        return schemas.PlanDiffRead(
            from_version=self.base_version,
            to_version=latest.version,
            published_at=latest.published_at,
            summary=latest.summary,
            planned_weight_before_kg=round(sum(r.weight_kg or 0.0 for r in before), 2),
            planned_weight_after_kg=run.planned_weight_kg,
            planned_volume_before_m3=round(sum(r.volume_m3 or 0.0 for r in before), 2),
            planned_volume_after_m3=run.planned_volume_m3,
            checks_saved=sum(1 for s in stops for r in s.orders if r.checked_at is not None),
            was_ready_at=was_ready_at,
        )


loader_service = LoaderService()
