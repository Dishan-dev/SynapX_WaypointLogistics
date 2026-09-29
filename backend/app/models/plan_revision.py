import enum
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, Enum, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


class PlanChangeKind(str, enum.Enum):
    """The three groups the plan-change diff is presented in, plus resequencing.

    UNLOAD_FROM_TRUCK is the expensive one - the order is already on the truck and
    has to come back off, so it becomes a pinned task on the updated checklist.
    DONT_LOAD is cheap by comparison: it never left staging.
    """

    UNLOAD_FROM_TRUCK = "unload_from_truck"
    DONT_LOAD = "dont_load"
    LOAD_NEW = "load_new"
    RESEQUENCE = "resequence"


class PlanRevision(Base):
    """One version of the dispatcher's plan for a run ("v2 -> v3").

    A revision published while loading is in progress blocks the checklist until it
    is acknowledged - that is what acknowledged_at/by record, and why the loader
    cannot release a run with an unacknowledged revision outstanding.

    The source strip reads from here: "Plan from Dispatcher - v3 - updated 02:14 -
    acknowledged by Saman J. 02:16".
    """

    __tablename__ = "plan_revisions"
    __table_args__ = (
        UniqueConstraint("run_id", "version", name="uq_plan_revision_version"),
    )

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("delivery_runs.id"), nullable=False)
    version = Column(Integer, nullable=False)
    published_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    source = Column(String(100), default="Dispatcher", nullable=False)
    summary = Column(Text, nullable=True)

    # Plan totals at this version, so the diff can show "4,920 -> 4,690 kg"
    # without recomputing the previous version's rows.
    planned_weight_kg = Column(Float, nullable=True)
    planned_volume_m3 = Column(Float, nullable=True)

    acknowledged_at = Column(DateTime, nullable=True)
    acknowledged_by_id = Column(Integer, ForeignKey("loader_users.id"), nullable=True)

    run = relationship("DeliveryRun")
    acknowledged_by = relationship("LoaderUser")
    changes = relationship(
        "PlanRevisionChange",
        back_populates="revision",
        cascade="all, delete-orphan",
    )


class PlanRevisionChange(Base):
    """One line of the diff the loader has to read and acknowledge.

    `reason` is the dispatcher's words, shown verbatim under the order - e.g.
    "Store reported a cold-room fault at 02:05". The loader acts on the change;
    the reason is why they should not argue with it.
    """

    __tablename__ = "plan_revision_changes"

    id = Column(Integer, primary_key=True, index=True)
    revision_id = Column(Integer, ForeignKey("plan_revisions.id"), nullable=False)
    change_kind = Column(Enum(PlanChangeKind), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    outlet_id = Column(Integer, ForeignKey("outlets.id"), nullable=True)
    reason = Column(Text, nullable=True)
    position = Column(Integer, default=0, nullable=False)

    revision = relationship("PlanRevision", back_populates="changes")
    order = relationship("Order")
    outlet = relationship("Outlet")
