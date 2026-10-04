from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict
from app.models.notification import NotificationCategory, NotificationType


class NotificationRead(BaseModel):
    id: int
    # Set on a Store Manager's notification; null on a driver's or a dispatcher's.
    outlet_id: Optional[int] = None
    dispatch_trip_id: Optional[int] = None
    order_id: Optional[int] = None
    order_number: Optional[str] = None
    type: NotificationType
    category: NotificationCategory
    title: str
    message: Optional[str] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationsMarkedRead(BaseModel):
    updated: int
