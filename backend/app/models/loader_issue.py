import enum
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base


class IssueType(str, enum.Enum):
    MISSING = "missing"
    SHORT = "short"
    DAMAGED = "damaged"
    WONT_FIT = "wont_fit"


class IssueStatus(str, enum.Enum):
    """Mirrors the Sent -> Seen -> Decision tracker on the waiting screen.

    DEFAULT_APPLIED is distinct from DECIDED: the decide-by time passed and the
    system applied the pre-agreed fallback, rather than the dispatcher choosing.
    The loader is shown which of the two happened.
    """

    SENT = "sent"
    SEEN = "seen"
    DECIDED = "decided"
    DEFAULT_APPLIED = "default_applied"


class LoaderIssue(Base):
    """A shortfall the loader reports from the dock, routed to the dispatcher.

    units_affected / units_total drive the stepper and the "53 of 56 units will be
    loaded" line, so both are kept rather than a single remaining count.

    decide_by is departure minus 20 minutes. If no decision lands by then, the
    option flagged as default on LoaderIssueOption is applied and status becomes
    DEFAULT_APPLIED - the truck cannot wait indefinitely.

    The run stays blocked from release while an issue is unresolved, which is what
    the "Release locked - 1 issue waiting" button reads.
    """

    __tablename__ = "loader_issues"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("delivery_runs.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    # Postgres type named loaderissuetype: the driver team's issue_reports already
    # owns "issuetype" (and "issuestatus") on the shared database.
    issue_type = Column(Enum(IssueType, name="loaderissuetype"), nullable=False)

    units_affected = Column(Integer, nullable=True)
    units_total = Column(Integer, nullable=True)

    quick_note_tag = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    photo_path = Column(String(500), nullable=True)

    reported_by_id = Column(Integer, ForeignKey("loader_users.id"), nullable=False)
    reported_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Idempotency for the flag write, same contract as LoadingCheck: the tablet
    # generates this UUID once per tap and replays it from the offline queue, so
    # the unique constraint is what stops one flag becoming two issues.
    # Nullable because issues raised server-side (or seeded) have no tablet tap
    # behind them, and Postgres lets NULLs repeat under a unique index.
    client_action_id = Column(String(64), unique=True, index=True, nullable=True)

    status = Column(Enum(IssueStatus, name="loaderissuestatus"), default=IssueStatus.SENT, nullable=False)
    seen_at = Column(DateTime, nullable=True)
    decide_by = Column(DateTime, nullable=True)
    decided_at = Column(DateTime, nullable=True)
    decided_by = Column(String(255), nullable=True)

    run = relationship("DeliveryRun")
    order = relationship("Order")
    reported_by = relationship("LoaderUser")
    options = relationship(
        "LoaderIssueOption",
        back_populates="issue",
        cascade="all, delete-orphan",
    )


class LoaderIssueOption(Base):
    """One option the dispatcher could pick for an issue.

    Shown to the loader after the fact as "Options the Dispatcher had", so they can
    see the trade-off behind the answer rather than just the outcome.

    is_default marks the option applied automatically if decide_by passes.
    """

    __tablename__ = "loader_issue_options"

    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("loader_issues.id"), nullable=False)
    label = Column(String(255), nullable=False)
    detail = Column(Text, nullable=True)
    is_default = Column(Boolean, default=False, nullable=False)
    is_chosen = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0, nullable=False)

    issue = relationship("LoaderIssue", back_populates="options")
