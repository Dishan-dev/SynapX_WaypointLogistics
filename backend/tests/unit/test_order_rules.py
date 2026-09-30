from datetime import date, datetime

from app.services import order_rules

HOLIDAYS = {date(2026, 10, 1)}


def is_operating(day: date) -> bool:
    return day.weekday() != 6 and day not in HOLIDAYS


def test_cutoff_is_4pm_the_day_before():
    assert order_rules.cutoff_for(date(2026, 9, 28)) == datetime(2026, 9, 27, 16, 0)


def test_cutoff_is_strict_at_exactly_4pm():
    delivery = date(2026, 9, 30)
    assert order_rules.is_past_cutoff(delivery, datetime(2026, 9, 29, 16, 0, 0))
    assert not order_rules.is_past_cutoff(delivery, datetime(2026, 9, 29, 15, 59, 59))


def test_earliest_default_is_two_operating_days_skipping_sunday():
    # Fri 25 Sep → Sat 26 (1), Sun 27 skipped, Mon 28 (2)
    assert order_rules.earliest_delivery_date(datetime(2026, 9, 25, 10, 0), False, is_operating) == date(2026, 9, 28)


def test_earliest_high_priority_is_next_operating_day():
    assert order_rules.earliest_delivery_date(datetime(2026, 9, 25, 10, 0), True, is_operating) == date(2026, 9, 26)


def test_earliest_moves_on_when_cutoff_has_passed():
    # After 4 PM Fri, Sat 26 is closed, Sun 27 is not operating → Mon 28
    assert order_rules.earliest_delivery_date(datetime(2026, 9, 25, 17, 0), True, is_operating) == date(2026, 9, 28)


def test_earliest_skips_holidays():
    # Tue 29 Sep after cutoff → Wed 30 closed, Thu 1 Oct holiday → Fri 2 Oct
    assert order_rules.earliest_delivery_date(datetime(2026, 9, 29, 17, 0), True, is_operating) == date(2026, 10, 2)


def test_next_operating_day_skips_holiday_and_sunday():
    assert order_rules.next_operating_day(date(2026, 9, 30), is_operating) == date(2026, 10, 2)
    assert order_rules.next_operating_day(date(2026, 9, 26), is_operating) == date(2026, 9, 28)


def test_split_by_temperature_puts_chilled_first():
    assert order_rules.split_by_temperature(["Ambient", "Chilled", "Ambient"]) == ["Chilled", "Ambient"]


def test_fresh_outlets_get_one_order_per_zone_per_day():
    assert order_rules.duplicate_zones("fresh", ["Chilled", "Ambient"], ["Ambient"]) == ["Ambient"]
    assert order_rules.duplicate_zones("fresh", ["Chilled"], ["Ambient"]) == []


def test_other_brands_get_one_order_per_day():
    assert order_rules.duplicate_zones("style", ["Ambient"], ["Ambient"]) == ["Ambient"]
    assert order_rules.duplicate_zones("tech", ["Ambient"], []) == []
