"""Response shapes for the loader endpoints owned by L0/L4/L7/L8/L9.

Scope note: only the endpoints in this module's own features are modelled here.
The queue, sign-in and issue-list shapes (L2/L3/L5) are Sanduni's and are
proposed in docs/loader/API_CONTRACT.md for her to review rather than coded here.
"""
from datetime import datetime, time, timezone
from typing import Annotated, List, Optional
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


class RunOrderRead(BaseModel):
    order_number: str
    temperature_class: Optional[TemperatureClass] = None
    units: Optional[int] = None
    weight_kg: Optional[float] = None
    volume_m3: Optional[float] = None
    state: RunOrderState
    checked_at: Optional[UtcDateTime] = None
    checked_by: Optional[str] = None


class RunStopRead(BaseModel):
    stop_sequence: int
    load_position: int
    eta: Optional[UtcDateTime] = None
    handling_minutes: Optional[int] = None
    status: StopStatus
    outlet: OutletRead
    orders: List[RunOrderRead]


class PlanRevisionRead(BaseModel):
    version: int
    published_at: UtcDateTime
    source: str
    summary: Optional[str] = None
    acknowledged_at: Optional[UtcDateTime] = None
    acknowledged_by: Optional[str] = None


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
    current_plan_version: int
    dock: str
    vehicle: VehicleRead
    capacity: CapacityRead
    plan: Optional[PlanRevisionRead] = None
    unacknowledged_plan_version: Optional[int] = None
    stops: List[RunStopRead]
    orders_checked: int
    orders_total: int


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


# --- Dev-only simulation payloads ----------------------------------------


class SimulatedPlanChangeRequest(BaseModel):
    """Body for the dev plan-change endpoint. All fields optional.

    Defaults reproduce the Figma v2 -> v3 change on RUN-021 exactly.
    """

    unload_order_numbers: Optional[List[str]] = None
    dont_load_order_numbers: Optional[List[str]] = None
    load_new_order_numbers: Optional[List[str]] = None
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
