"""Business logic behind the loader endpoints.

Endpoints stay thin; anything that decides something lives here.
"""
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import InvalidStateTransitionError, NotFoundError
from app.models.delivery_run import DeliveryRun, RunOrderState, RunStatus, RunStop, RunStopOrder
from app.models.loader_activity import ActorKind, LoaderActivity
from app.models.loader_issue import IssueStatus, LoaderIssue, LoaderIssueOption
from app.models.order import Order
from app.models.plan_revision import PlanChangeKind, PlanRevision, PlanRevisionChange
from app.models.reference import Dock
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

        stop_reads: List[schemas.RunStopRead] = []
        checked = 0
        total = 0
        for stop in stops:
            order_reads = []
            for row in sorted(stop.orders, key=lambda r: r.order.order_number):
                if row.state not in OFF_PLAN_STATES:
                    total += 1
                    if row.state in RESOLVED_STATES:
                        checked += 1
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
            stops=stop_reads,
            orders_checked=checked,
            orders_total=total,
        )

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

    # --- helpers ----------------------------------------------------------

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
        order_id: Optional[int] = None,
    ) -> LoaderActivity:
        entry = LoaderActivity(
            run_id=run.id,
            at=at,
            actor_kind=actor_kind,
            actor_label=actor_label,
            event_type=event_type,
            order_id=order_id,
            message=message,
        )
        db.add(entry)
        return entry

    # --- dev-only simulation ---------------------------------------------

    @staticmethod
    def simulate_plan_change(
        db: Session,
        run: DeliveryRun,
        payload: schemas.SimulatedPlanChangeRequest,
    ) -> PlanRevision:
        """Publish the next plan version, as the dispatcher would.

        Copies the current version's stops and rows forward, applies the three
        kinds of change, and leaves the revision unacknowledged so the checklist
        blocks until the loader reads it.
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

        unload = set(payload.unload_order_numbers or [])
        dont_load = set(payload.dont_load_order_numbers or [])
        load_new = list(payload.load_new_order_numbers or [])

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
                if number in unload:
                    # Already aboard: it has to physically come back off.
                    state = RunOrderState.TAKE_OFF
                elif number in dont_load:
                    # Never left staging, so it is simply dropped.
                    state = RunOrderState.MOVED
                elif old_row.state in ON_TRUCK_STATES:
                    # Anything already checked is re-confirmed, never silently kept.
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
            source="Dispatcher",
            summary=payload.summary or f"Plan v{old_version} -> v{new_version}",
            planned_weight_kg=run.planned_weight_kg,
            planned_volume_m3=run.planned_volume_m3,
        )
        db.add(revision)
        db.flush()

        for position, (kind, numbers) in enumerate(
            [
                (PlanChangeKind.UNLOAD_FROM_TRUCK, sorted(unload)),
                (PlanChangeKind.DONT_LOAD, sorted(dont_load)),
                (PlanChangeKind.LOAD_NEW, load_new),
            ]
        ):
            for number in numbers:
                order = db.execute(
                    select(Order).filter_by(order_number=number)
                ).scalars().first()
                db.add(
                    PlanRevisionChange(
                        revision_id=revision.id,
                        change_kind=kind,
                        order_id=order.id if order else None,
                        outlet_id=order.outlet_id if order else None,
                        position=position,
                    )
                )

        LoaderService.log(
            db, run, at=now, actor_kind=ActorKind.DISPATCHER,
            event_type="plan_published", actor_label="Dispatcher",
            message=f"Dispatcher published plan v{new_version}",
        )
        db.flush()
        return revision

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


loader_service = LoaderService()
