"""Field formula evaluation for log sheet calculated fields."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

DIFF_PATTERN = re.compile(r"^\s*(\w+)\s*-\s*(\w+)\s*$")


def _parse_iso(value: Any) -> datetime | None:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None


def _format_duration(minutes: float) -> str:
    total = int(round(abs(minutes)))
    hours, mins = divmod(total, 60)
    if hours > 0:
        return f"{hours}h {mins}m"
    return f"{mins}m"


def evaluate_subtraction(left: Any, right: Any, left_type: str, right_type: str) -> str | None:
    if left_type in ("datetime", "calculated") or right_type in ("datetime", "calculated"):
        start = _parse_iso(left)
        end = _parse_iso(right)
        if not start or not end:
            return None
        minutes = (end - start).total_seconds() / 60
        return _format_duration(minutes)
    try:
        lv = float(left) if left not in (None, "") else None
        rv = float(right) if right not in (None, "") else None
        if lv is None or rv is None:
            return None
        result = lv - rv
        if result == int(result):
            return str(int(result))
        return str(round(result, 2))
    except (TypeError, ValueError):
        return None


def evaluate_formula(formula: str, field_values: dict[str, Any], field_types: dict[str, str]) -> str | None:
    if not formula:
        return None
    match = DIFF_PATTERN.match(formula)
    if not match:
        return None
    left_key, right_key = match.group(1), match.group(2)
    left = field_values.get(left_key)
    right = field_values.get(right_key)
    left_type = field_types.get(left_key, "text")
    right_type = field_types.get(right_key, "text")
    return evaluate_subtraction(left, right, left_type, right_type)


def collect_calculated_fields(sections: list) -> list[tuple[str, str]]:
    """Return list of (field_key, formula) from template sections."""
    result: list[tuple[str, str]] = []
    for section in sections:
        fields = getattr(section, "fields", None) or section.get("fields", [])
        for field in fields:
            ftype = getattr(field, "field_type", None) or field.get("field_type")
            type_str = ftype.value if hasattr(ftype, "value") else str(ftype)
            if type_str == "calculated":
                name = getattr(field, "name", None) or field.get("name")
                formula = getattr(field, "formula", None) or field.get("formula")
                if name and formula:
                    result.append((name, formula))
    return result


def apply_calculated_fields(
    field_map: dict[str, Any],
    field_types: dict[str, str],
    calculated_specs: list[tuple[str, str]],
) -> dict[str, str]:
    updates: dict[str, str] = {}
    for key, formula in calculated_specs:
        value = evaluate_formula(formula, field_map, field_types)
        if value is not None:
            updates[key] = value
            field_map[key] = value
    return updates
