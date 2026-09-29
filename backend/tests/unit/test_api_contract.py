"""Guards docs/loader/API_CONTRACT.md against drifting from the code.

The contract is what the other loader branch builds against, so a stale enum
value there is a real defect - it just fails in the frontend instead of here.
"""
import re
from pathlib import Path

import pytest

from app.models.delivery_run import RunOrderState, RunStatus
from app.models.loader_activity import ActorKind
from app.models.loader_issue import IssueStatus, IssueType
from app.models.plan_revision import PlanChangeKind
from app.models.reference import Brand, DockType, TempCapability, TemperatureClass, VehicleType

CONTRACT = Path(__file__).resolve().parents[2].parent / "docs" / "loader" / "API_CONTRACT.md"

# Every enum the contract publishes, against the enum it must mirror.
DOCUMENTED_ENUMS = {
    "run_status": RunStatus,
    "order_state": RunOrderState,
    "temperature_class": TemperatureClass,
    "brand": Brand,
    "dock_type": DockType,
    "vehicle_type": VehicleType,
    "temp_capability": TempCapability,
    "issue_type": IssueType,
    "issue_status": IssueStatus,
    "change_kind": PlanChangeKind,
    "actor_kind": ActorKind,
}


@pytest.fixture(scope="module")
def contract_text() -> str:
    assert CONTRACT.exists(), f"contract missing at {CONTRACT}"
    return CONTRACT.read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def documented_values(contract_text: str) -> dict:
    """Parse the `| `enum` | `a` · `b` |` rows out of the Shared enums table."""
    values = {}
    for line in contract_text.splitlines():
        match = re.match(r"^\|\s*`(\w+)`\s*\|\s*(.+?)\s*\|\s*$", line)
        if match and match.group(1) in DOCUMENTED_ENUMS:
            values[match.group(1)] = re.findall(r"`([a-z_]+)`", match.group(2))
    return values


@pytest.mark.parametrize("name", sorted(DOCUMENTED_ENUMS))
def test_documented_enum_matches_the_code(name, documented_values):
    assert name in documented_values, f"{name} is not in the Shared enums table"
    expected = [member.value for member in DOCUMENTED_ENUMS[name]]
    assert documented_values[name] == expected, (
        f"{name} in API_CONTRACT.md is out of date with the model"
    )


def test_the_six_enums_the_team_asked_for_are_all_documented(documented_values):
    required = {
        "run_status",
        "order_state",
        "temperature_class",
        "dock_type",
        "issue_type",
        "issue_status",
    }
    assert required <= set(documented_values)


def test_client_action_id_contract_is_stated(contract_text):
    """The three things a client must know, not just the field name."""
    assert "## `client_action_id` — the write contract" in contract_text

    section = contract_text.split("## `client_action_id`")[1].split("\n---")[0]
    lowered = section.lower()

    # A UUID the tablet generates.
    assert "uuid" in lowered
    # In the JSON body, not a header or query param.
    assert "json request body" in lowered
    assert "not a header" in lowered
    # A duplicate is a 200 with the original result, not an error.
    assert "returns the original result with `200`" in section
    assert "not applied twice" in lowered


def test_write_contract_names_the_endpoints_it_covers(contract_text):
    section = contract_text.split("## `client_action_id`")[1].split("\n---")[0]

    for verb in ("check", "flag", "acknowledge", "release"):
        assert verb in section.lower(), f"write contract does not mention {verb}"
    # The dev endpoints are explicitly exempt - they are not tablet-originated.
    assert "/loader/dev/*" in section


def test_page_routes_are_listed_with_owners(contract_text):
    assert "## Page routes" in contract_text
    section = contract_text.split("## Page routes")[1].split("\n## ")[0]

    # Sanduni's pages, named in the task.
    for route in ("/loader/sign-in", "/loader/issues", "/loader/runs/[code]/review"):
        assert route in section, f"{route} missing from the page routes"
    # And this branch's, so the two do not collide on the same files.
    for route in ("/loader/runs/[code]", "/loader/issues/[id]", "/loader/log"):
        assert route in section, f"{route} missing from the page routes"

    assert "Sanduni's pages" in section
    assert "Sachintha's pages" in section


def test_both_activity_endpoints_are_documented(contract_text):
    assert "### `GET /loader/activity`" in contract_text
    assert "### `GET /loader/runs/{code}/activity`" in contract_text
    # Their opposite orderings are the thing most likely to surprise a caller.
    assert "**Oldest first.**" in contract_text
    assert "**Newest first**" in contract_text
