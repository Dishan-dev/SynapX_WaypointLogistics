from datetime import date, datetime, timedelta
from typing import Dict, List
from sqlalchemy.orm import Session
from app.models.reference import CalendarDay
from app.services import order_rules


class CalendarService:
    """Operating days come from calendar_days (seeded from calendar.csv). A date with no row falls back to
    "every day except Sunday", so ordering still works before the calendar is seeded."""

    @staticmethod
    def _overrides(db: Session, start: date, end: date) -> Dict[date, bool]:
        rows = db.query(CalendarDay).filter(CalendarDay.date >= start, CalendarDay.date <= end).all()
        return {row.date: row.is_operating for row in rows}

    @staticmethod
    def is_operating_day(db: Session, day: date) -> bool:
        row = db.query(CalendarDay).filter(CalendarDay.date == day).first()
        if row is not None:
            return row.is_operating
        return day.weekday() != 6

    @staticmethod
    def holiday_name(db: Session, day: date) -> str | None:
        row = db.query(CalendarDay).filter(CalendarDay.date == day).first()
        if row is not None and not row.is_operating:
            return row.holiday_name or "a non-operating day"
        return "Sunday" if day.weekday() == 6 else None

    @staticmethod
    def checker(db: Session, around: date, days: int = 60):
        """Returns an is_operating_day(date) function backed by one query, for the pure rule functions."""
        overrides = CalendarService._overrides(db, around - timedelta(days=1), around + timedelta(days=days))

        def is_operating(day: date) -> bool:
            if day in overrides:
                return overrides[day]
            return day.weekday() != 6

        return is_operating

    @staticmethod
    def get_next_operating_day(db: Session, after: date) -> date:
        return order_rules.next_operating_day(after, CalendarService.checker(db, after))

    @staticmethod
    def earliest_delivery_date(db: Session, now: datetime, is_priority: bool) -> date:
        return order_rules.earliest_delivery_date(now, is_priority, CalendarService.checker(db, now.date()))

    @staticmethod
    def operating_days(db: Session, start: date, end: date) -> List[date]:
        is_operating = CalendarService.checker(db, start, (end - start).days + 1)
        return [start + timedelta(days=i) for i in range((end - start).days + 1) if is_operating(start + timedelta(days=i))]


calendar_service = CalendarService()
