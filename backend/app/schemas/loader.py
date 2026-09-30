"""Response shapes for the loader endpoints owned by L0/L4/L7/L8/L9.

Scope note: only the endpoints in this module's own features are modelled here.
The queue, sign-in and issue-list shapes (L2/L3/L5) are Sanduni's and are
proposed in docs/loader/API_CONTRACT.md for her to review rather than coded here.
"""
from datetime import date, datetime, time, timezone
from typing import Annotated, Dict, List, Optional
from uuid import UUID

from pydantic import AfterValidator, BaseModel, ConfigDict

from app.models.delivery_run import RunOrderState, RunStatus, StopStatus
from app.models.loader_activity import ActorKind
from app.models.loader_issue import IssueStatus, IssueType
from app.models.plan_revision import PlanChangeKind
from app.models.reference import Brand, DockType, TempCapability, TemperatureClass, VehicleType


def _as_utc(value: datetime) -> datetime:
    """Label a stored datetime as UTC so it serializes with a Z.

    Every datetime is stored in UTC in naive columns, so what comes back from
    the database has no tzinfo. Without this the API would send
    "2026-05-27T22:00:00", which a browser reads as its own local time.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


# Every loader datetime on the wire: ISO 8601 in UTC, e.g. "2026-05-27T22:00:00Z".
# The frontend formats them in depot time (Asia/Colombo). Outlet delivery
# windows are plain `time` values in depot time and are not converted.
UtcDateTime = Annotated[datetime, AfterValidator(_as_utc)]


class VehicleRead(BaseModel):
    code: str
    vehicle_type: VehicleType
    temp_capability: TempCapability
    max_weight_kg: float
    max_volume_m3: float

    model_config = ConfigDict(from_attributes=True)


class OutletRead(BaseModel):
    code: str
    name: str
    brand: Brand
    district: str
    dock_type: DockType
    van_only: bool
    window_start: Optional[time] = None
    window_end: Optional[time] = None

    model_config = ConfigDict(from_attributes=True)


class CapacityRead(BaseModel):
    """Drives the two capacity bars: loaded over the vehicle limit, planned as marker."""

    loaded_weight_kg: float
    planned_weight_kg: float
    max_weight_kg: float
    loaded_volume_m3: float
    planned_volume_m3: float
    max_volume_m3: float


class MovedToRead(BaseModel):
    """Where a dont_load order went: "Moved to VEH003 · Trip 1 · 03:45".

    run_code is null when the other trip has no loader run yet, and departs_at
    when the dispatcher has not timed it. The frontend formats the time.
    """

    run_code: Optional[str] = None
    vehicle_code: str
    trip_number: int
    departs_at: Optional[UtcDateTime] = None


class RunOrderRead(BaseModel):
    order_number: str
    temperature_class: Optional[TemperatureClass] = None
    units: Optional[int] = None
    weight_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    state: RunOrderState
    checked_at: Optional[UtcDateTime] = None
    checked_by: Optional[str] = None
    # Units actually on the truck: all of them once loaded (re_check and a
    # take_off not yet unloaded count, the goods are aboard), units minus the
    # flagged units for short / damaged / won't fit (0 if the flag has no
    # count), 0 for missing and for anything not loaded. "53 of 56 units will be loaded".
    loaded_units: int = 0

    # --- Plan diff (L7). All null on an order the latest change left alone.
    # Plan version whose change this row is showing.
    changed_in_version: Optional[int] = None
    # Which group of the diff the order is in. null for re_check (the loader
    # re-confirms it; the dispatcher did not change it) and for a rechecked row.
    change_kind: Optional[PlanChangeKind] = None
    # Short, time-free line for the row, e.g. "Take off the truck" or
    # "Re-check · moved to reach ORD0092308". Times are added by the frontend.
    note: Optional[str] = None
    # The dispatcher's own words for this order, shown in the diff card.
    reason: Optional[str] = None
    # Filled once plan_revision_changes stores the target (migration fix);
    # always null until then.
    moved_to: Optional[MovedToRead] = None
    deferred_to: Optional[date] = None
    # When the order came off the truck ("off truck 02:24") and who took it off.
    unloaded_at: Optional[UtcDateTime] = None
    unloaded_by: Optional[str] = None


class RunStopRead(BaseModel):
    stop_sequence: int
    load_position: int
    eta: Optional[UtcDateTime] = None
    handling_minutes: Optional[int] = None
    status: StopStatus
    outlet: OutletRead
    orders: List[RunOrderRead]
    # Against the plan before the latest change: "was Stop 4", or "new stop".
    note: Optional[str] = None
    is_new: bool = False


class PlanRevisionRead(BaseModel):
    version: int
    published_at: UtcDateTime
    source: str
    summary: Optional[str] = None
    acknowledged_at: Optional[UtcDateTime] = None
    acknowledged_by: Optional[str] = None


class PlanDiffRead(BaseModel):
    """The latest plan change as one diff, for the takeover (Figma 2a, 2d).

    from_version is the plan the loader last acknowledged before this change,
    so stacked versions read as one diff: v2 -> v4, confirmed once. Still sent
    after the acknowledgement, so the updated checklist keeps its notes.
    """

    from_version: int
    to_version: int
    published_at: UtcDateTime
    summary: Optional[str] = None
    # "Capacity after change": 4,920 -> 4,690 kg.
    planned_weight_before_kg: float
    planned_weight_after_kg: float
    planned_volume_before_m3: float
    planned_volume_after_m3: float
    # "Your 5 checked orders are saved": rows that still carry a check.
    checks_saved: int
    # Set when this change reopened a signed-off run: "was Ready 01:48".
    was_ready_at: Optional[UtcDateTime] = None


class ReleaseBlockerRead(BaseModel):
    """One reason release is locked, e.g. {"code": "re_check_pending", "count": 2}.

    Codes, in the order the footer lists them:
    plan_not_acknowledged, unload_pending, re_check_pending, orders_open,
    issue_waiting.
    """

    code: str
    count: int


class LoaderRefRead(BaseModel):
    """A loader named on a record: {"id": 1, "name": "Saman J."}."""

    id: int
    name: str


class PlanChangeRead(BaseModel):
    change_kind: PlanChangeKind
    order_number: Optional[str] = None
    outlet_code: Optional[str] = None
    reason: Optional[str] = None


class RunDetailRead(BaseModel):
    """GET /loader/runs/{code} - the L4 checklist.

    `stops` is ordered by load_position, not stop_sequence: the loader works the
    truck from the cab outwards, which is the reverse of the delivery order.
    """

    code: str
    trip_number: int
    brand: Brand
    district: str
    wave: Optional[str] = None
    departs_at: UtcDateTime
    status: RunStatus
    # Who signed the run off and when ("signed off by Saman J. 03:06"). Only
    # while the run is ready_to_depart or gated_out: null before release, after
    # an undo, and after a plan change reopens it (that time is in
    # plan_change.was_ready_at).
    released_at: Optional[UtcDateTime] = None
    released_by: Optional[LoaderRefRead] = None
    current_plan_version: int
    dock: str
    vehicle: VehicleRead
    capacity: CapacityRead
    plan: Optional[PlanRevisionRead] = None
    unacknowledged_plan_version: Optional[int] = None
    # The newest version someone acknowledged; with current_plan_version it
    # makes the queue card's "Plan updated · v2 -> v3".
    acknowledged_plan_version: Optional[int] = None
    # null when the run has no earlier plan on record to compare against.
    plan_change: Optional[PlanDiffRead] = None
    stops: List[RunStopRead]
    # Two different counts over the same orders_total (take_off / moved excluded):
    # - orders_loaded: state loaded only - what is on the truck and confirmed.
    #   The queue's "3 of 5 loaded" and the "x of y orders in" line.
    # - orders_checked: loaded OR flagged - no longer blocking review. The
    #   review lock, "Review & confirm · 4 of 5".
    # re_check counts toward neither until it is confirmed again.
    orders_loaded: int
    orders_checked: int
    orders_total: int
    # Release (L6) is locked while any blocker is listed. The same list backs
    # LoaderService.release_blockers, which POST /release should check.
    release_locked: bool
    release_blockers: List[ReleaseBlockerRead]


class IssueOptionRead(BaseModel):
    label: str
    detail: Optional[str] = None
    is_default: bool
    is_chosen: bool


class IssueDetailRead(BaseModel):
    """GET /loader/issues/{id} - the L8 waiting and decision screens."""

    id: int
    run_code: str
    order_number: str
    outlet_code: Optional[str] = None
    issue_type: IssueType
    units_affected: Optional[int] = None
    units_total: Optional[int] = None
    quick_note_tag: Optional[str] = None
    note: Optional[str] = None
    photo_path: Optional[str] = None
    reported_by: str
    reported_at: UtcDateTime
    status: IssueStatus
    seen_at: Optional[UtcDateTime] = None
    decide_by: Optional[UtcDateTime] = None
    decided_at: Optional[UtcDateTime] = None
    decided_by: Optional[str] = None
    options: List[IssueOptionRead]


class ActivityRead(BaseModel):
    """One entry in the L9 log.

    Used by both activity endpoints. `run_code` is redundant on the per-run
    timeline but carried anyway, so the dock-wide feed and the per-run timeline
    render from one shape.
    """

    at: UtcDateTime
    run_code: str
    actor_kind: ActorKind
    actor: Optional[str] = None
    event_type: str
    order_number: Optional[str] = None
    message: str


# --- Writes from the tablet -----------------------------------------------


class OrderActionRequest(BaseModel):
    """Body for check, uncheck and recheck on one checklist row.

    client_action_id is generated once per tap by the tablet and reused on every
    retry of that tap - a repeat returns the run with 200 and applies nothing.

    plan_version is the version the loader was looking at when they tapped. If
    the dispatcher has published a newer one since, the write is refused with
    409 PLAN_VERSION_STALE rather than applied to a plan the loader never saw.

    The offline outbox also sends run_code and order_number in the body; the
    path is authoritative, so extra fields are ignored.
    """

    client_action_id: UUID
    plan_version: int
    loader_session_id: Optional[int] = None

    model_config = ConfigDict(extra="ignore")


class AcknowledgePlanRequest(BaseModel):
    """Body for POST /loader/runs/{code}/plan/{version}/acknowledge.

    plan_version must match the version in the path; it is carried in the body
    too so every tablet write has the same shape.

    loader_session_id is who the Dispatcher sees as "received by". It is
    optional until L2 sign-in lands; without it the acknowledgement is recorded
    with no loader.
    TODO(L2): make loader_session_id required once sign-in is merged.
    """

    client_action_id: UUID
    plan_version: int
    loader_session_id: Optional[int] = None

    model_config = ConfigDict(extra="ignore")


# --- Dev-only simulation payloads ----------------------------------------


class SimulatedPlanChangeRequest(BaseModel):
    """Body for the dev plan-change endpoint. All fields optional.

    Defaults reproduce the Figma v2 -> v3 change on RUN-021 exactly.
    """

    unload_order_numbers: Optional[List[str]] = None
    dont_load_order_numbers: Optional[List[str]] = None
    load_new_order_numbers: Optional[List[str]] = None
    # Loaded orders the loader has to re-confirm (moved to reach one coming
    # off). Omitted: every order aboard goes to re_check.
    recheck_order_numbers: Optional[List[str]] = None
    # The dispatcher's words per order, shown in the diff.
    reasons: Optional[Dict[str, str]] = None
    summary: Optional[str] = None


class SimulatedDecisionRequest(BaseModel):
    """Body for the dev decision endpoint."""

    option_label: Optional[str] = None
    decided_by: str = "Kasun Perera"


class SimulationResult(BaseModel):
    detail: str
    run_code: Optional[str] = None
    plan_version: Optional[int] = None
    issue_id: Optional[int] = None
    changes: List[PlanChangeRead] = []
