from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.core.exceptions import NotFoundError
from app.models.notification import Notification, NotificationCategory
from app.models.reference import Depot, Outlet
from app.models.user import User
from app.schemas.notification import NotificationRead, NotificationsMarkedRead
from app.services.notification_service import notification_service

# Store Manager notifications (Figma 10, contract §5), plus the driver's and the
# depot dispatcher's (a run released by the loader).
router = APIRouter()


def _loader_catch_up(db: Session) -> None:
    """Releases whose undo window has closed are announced on this read: there
    is no worker, and the driver and dispatcher poll this list."""
    from app.services.loader_service import loader_service

    if loader_service.notify_due_releases(db):
        db.commit()


@router.get("/driver", response_model=List[NotificationRead])
def list_driver_notifications(
    unread: bool = False,
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(deps.get_db),
    driver: User = Depends(deps.require_driver),
):
    """The signed-in driver's notifications, newest first."""
    _loader_catch_up(db)
    return notification_service.list_for_driver(db, driver.id, unread, limit)


@router.patch("/driver/{notification_id}/read", response_model=NotificationRead)
def mark_driver_notification_read(
    notification_id: int, db: Session = Depends(deps.get_db), driver: User = Depends(deps.require_driver)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if notification is None or notification.recipient_user_id != driver.id:
        raise NotFoundError("Notification not found", entity="Notification", entity_id=notification_id)
    return notification_service.mark_read(db, notification_id)


@router.get("/dispatcher", response_model=List[NotificationRead])
def list_dispatcher_notifications(
    unread: bool = False,
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(deps.get_db),
    depot: Depot = Depends(deps.get_dispatcher_depot),
):
    """The depot dispatcher's notifications, newest first."""
    _loader_catch_up(db)
    return notification_service.list_for_depot_dispatcher(db, depot, unread, limit)


@router.patch("/dispatcher/{notification_id}/read", response_model=NotificationRead)
def mark_dispatcher_notification_read(
    notification_id: int, db: Session = Depends(deps.get_db), depot: Depot = Depends(deps.get_dispatcher_depot)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    if notification is None or notification.recipient_depot != depot:
        raise NotFoundError("Notification not found", entity="Notification", entity_id=notification_id)
    return notification_service.mark_read(db, notification_id)


@router.get("/", response_model=List[NotificationRead])
def list_notifications(
    outlet: Outlet = Depends(deps.get_store_outlet),
    category: Optional[NotificationCategory] = None,
    unread: bool = False,
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(deps.get_db),
):
    return notification_service.list_for_outlet(db, outlet.id, category, unread, limit)


@router.patch("/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int, db: Session = Depends(deps.get_db), current_user: User = Depends(deps.get_current_user)
):
    notification = db.query(Notification).filter(Notification.id == notification_id).first()
    # A driver's or a dispatcher's notification has no outlet: not a store's to mark.
    if notification is None or notification.outlet_id is None:
        raise NotFoundError("Notification not found", entity="Notification", entity_id=notification_id)
    deps.ensure_store_access(db, current_user, notification.outlet_id)
    return notification_service.mark_read(db, notification_id)


@router.post("/read-all", response_model=NotificationsMarkedRead)
def mark_all_notifications_read(outlet: Outlet = Depends(deps.get_store_outlet), db: Session = Depends(deps.get_db)):
    return {"updated": notification_service.mark_all_read(db, outlet.id)}
