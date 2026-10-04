from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from app.core.exceptions import NotFoundError
from app.models.notification import Notification, NotificationCategory, NotificationType
from app.models.reference import Depot

CATEGORY: Dict[NotificationType, NotificationCategory] = {
    NotificationType.ORDER_SUBMITTED: NotificationCategory.REQUEST,
    NotificationType.ORDER_CONFIRMED: NotificationCategory.REQUEST,
    NotificationType.DISPATCHER_NOTE: NotificationCategory.REQUEST,
    NotificationType.SHORTFALL_WARNING: NotificationCategory.REQUEST,
    NotificationType.DEFERRED: NotificationCategory.REQUEST,
    NotificationType.READY_FOR_DISPATCH: NotificationCategory.REQUEST,
    NotificationType.ORDER_CLOSED: NotificationCategory.REQUEST,
    NotificationType.ETA_UPDATED: NotificationCategory.DELIVERY,
    NotificationType.DELIVERED: NotificationCategory.DELIVERY,
    NotificationType.ISSUE_LOGGED: NotificationCategory.ISSUE,
    NotificationType.RUN_RELEASED: NotificationCategory.DELIVERY,
}


def _default_text(type_: NotificationType, meta: Dict[str, Any]) -> tuple[str, str]:
    """Standard wording per type (Figma 10). meta["title"] / meta["message"] override it."""
    order = meta.get("order_number", "Your order")
    when = meta.get("delivery_label", "")
    templates = {
        NotificationType.ORDER_SUBMITTED: (
            f"{order} submitted",
            f"Your goods request for {when} was sent to the depot." if when else "Your goods request was sent to the depot.",
        ),
        NotificationType.ORDER_CONFIRMED: (f"{order} accepted into the delivery plan", "The depot has scheduled your request."),
        NotificationType.DISPATCHER_NOTE: (f"Dispatcher note on {order}", meta.get("note", "The dispatcher added a note to your order.")),
        NotificationType.SHORTFALL_WARNING: (f"Shortfall on {order}", meta.get("note", "Some items could not be loaded in full.")),
        NotificationType.DEFERRED: (
            f"{order} deferred" + (f" to {meta['new_delivery_label']}" if meta.get("new_delivery_label") else ""),
            meta.get("reason", "Dispatch moved this request to a later day."),
        ),
        NotificationType.READY_FOR_DISPATCH: (
            f"{order} is ready for dispatch",
            f"The depot packed your order. Scheduled for {when}." if when else "The depot packed your order.",
        ),
        NotificationType.ETA_UPDATED: (
            f"{order} is approaching" + (f" — ETA {meta['eta']}" if meta.get("eta") else ""),
            meta.get("note", "Your delivery is on the way."),
        ),
        NotificationType.DELIVERED: (f"{order} arrived at the dock", "Count the items and confirm the delivery."),
        NotificationType.ISSUE_LOGGED: (
            f"Delivery issue logged: {meta.get('issue_code', '')}".strip(),
            meta.get("note", f"An issue was reported on {order}."),
        ),
        NotificationType.ORDER_CLOSED: (f"{order} closed", "The order is complete."),
        NotificationType.RUN_RELEASED: (
            f"{meta.get('run_code', 'A run')} is ready to depart",
            "The loader has released it.",
        ),
    }
    return templates[type_]


class NotificationService:
    @staticmethod
    def send(db: Session, outlet_id: int, type: NotificationType, meta: Optional[Dict[str, Any]] = None) -> Notification:
        """Contract: called by Dev A, Dev B (loading, receipts) and the Dispatcher team.

        meta keys: order_id, order_number, title, message, plus type-specific ones (reason, eta, note, issue_code…).
        """
        meta = meta or {}
        default_title, default_message = _default_text(type, meta)
        notification = Notification(
            outlet_id=outlet_id,
            order_id=meta.get("order_id"),
            type=type,
            category=CATEGORY[type],
            title=meta.get("title", default_title)[:200],
            message=meta.get("message", default_message),
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        return notification

    @staticmethod
    def _build(type: NotificationType, meta: Optional[Dict[str, Any]], **recipient) -> Notification:
        meta = meta or {}
        default_title, default_message = _default_text(type, meta)
        return Notification(
            **recipient,
            order_id=meta.get("order_id"),
            dispatch_trip_id=meta.get("dispatch_trip_id"),
            type=type,
            category=CATEGORY[type],
            title=meta.get("title", default_title)[:200],
            message=meta.get("message", default_message),
        )

    @staticmethod
    def send_to_driver(
        db: Session, user_id: int, type: NotificationType, meta: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """A driver's in-app notification (users.id). Added to the caller's
        transaction, not committed: the loader sends it inside its own write."""
        notification = NotificationService._build(type, meta, recipient_user_id=user_id)
        db.add(notification)
        return notification

    @staticmethod
    def send_to_depot_dispatcher(
        db: Session, depot: Depot, type: NotificationType, meta: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """The depot dispatcher's in-app notification. Addressed to the depot,
        since a dispatcher is scoped by depot. Not committed, as send_to_driver."""
        notification = NotificationService._build(type, meta, recipient_depot=depot)
        db.add(notification)
        return notification

    @staticmethod
    def list_for_driver(db: Session, user_id: int, unread_only: bool = False, limit: int = 100) -> List[Notification]:
        query = db.query(Notification).filter(Notification.recipient_user_id == user_id)
        if unread_only:
            query = query.filter(Notification.is_read.is_(False))
        return query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()

    @staticmethod
    def list_for_depot_dispatcher(
        db: Session, depot: Depot, unread_only: bool = False, limit: int = 100
    ) -> List[Notification]:
        query = db.query(Notification).filter(Notification.recipient_depot == depot)
        if unread_only:
            query = query.filter(Notification.is_read.is_(False))
        return query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()

    @staticmethod
    def list_for_outlet(
        db: Session,
        outlet_id: int,
        category: Optional[NotificationCategory] = None,
        unread_only: bool = False,
        limit: int = 100,
    ) -> List[Notification]:
        query = db.query(Notification).filter(Notification.outlet_id == outlet_id)
        if category is not None:
            query = query.filter(Notification.category == category)
        if unread_only:
            query = query.filter(Notification.is_read.is_(False))
        return query.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit).all()

    @staticmethod
    def mark_read(db: Session, notification_id: int) -> Notification:
        notification = db.query(Notification).filter(Notification.id == notification_id).first()
        if notification is None:
            raise NotFoundError("Notification not found", entity="Notification", entity_id=notification_id)
        if not notification.is_read:
            notification.is_read = True
            db.commit()
            db.refresh(notification)
        return notification

    @staticmethod
    def mark_all_read(db: Session, outlet_id: int) -> int:
        updated = (
            db.query(Notification)
            .filter(Notification.outlet_id == outlet_id, Notification.is_read.is_(False))
            .update({Notification.is_read: True}, synchronize_session=False)
        )
        db.commit()
        return updated


notification_service = NotificationService()
