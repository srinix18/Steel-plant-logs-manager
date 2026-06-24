"""SQLAlchemy types for VARCHAR-backed enum columns (schema patches)."""

from enum import Enum as PyEnum

from sqlalchemy import String, cast, func
from sqlalchemy.dialects.postgresql import ENUM as PGENUM
from sqlalchemy.types import TypeDecorator

from app.models.enums import (
    MaintenanceIssueStatus,
    ObservationCategory,
    ObservationSeverity,
    ProcessRunOutcome,
    ProcessRunType,
)


def category_value(cat: ObservationCategory | str) -> str:
    if isinstance(cat, ObservationCategory):
        return cat.value
    return str(cat).lower()


def categories_equal(a: ObservationCategory | str, b: ObservationCategory | str) -> bool:
    return category_value(a) == category_value(b)


def pg_category_matches_division(category_column, division: ObservationCategory):
    """Match PG enum category column to lowercase varchar maintenance_division."""
    return func.lower(cast(category_column, String)) == category_value(division)


class _EnumAsString(TypeDecorator):
    """Store enum .value in VARCHAR; expose Python enum on read."""

    impl = String(32)
    cache_ok = True

    def __init__(self, enum_cls: type[PyEnum], length: int = 32):
        super().__init__(length)
        self.enum_cls = enum_cls

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, self.enum_cls):
            return value.value
        return str(value).lower()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return self.enum_cls(str(value).lower())


class ObservationCategoryString(_EnumAsString):
    cache_ok = True

    def __init__(self):
        super().__init__(ObservationCategory)


class ObservationSeverityString(_EnumAsString):
    cache_ok = True

    def __init__(self):
        super().__init__(ObservationSeverity)


class MaintenanceIssueStatusString(_EnumAsString):
    cache_ok = True

    def __init__(self):
        super().__init__(MaintenanceIssueStatus)


class _LegacyTolerantPgEnum(TypeDecorator):
    """PostgreSQL ENUM: write lowercase .value; read legacy UPPER member names too."""

    cache_ok = True

    def __init__(self, enum_cls: type[PyEnum], pg_name: str):
        self.enum_cls = enum_cls
        labels: list[str] = []
        seen: set[str] = set()
        for member in enum_cls:
            for label in (member.value, member.name):
                if label not in seen:
                    seen.add(label)
                    labels.append(label)
        self.impl = PGENUM(*labels, name=pg_name, create_type=False)
        super().__init__()

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, self.enum_cls):
            return value.value
        return str(value).lower()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, self.enum_cls):
            return value
        raw = str(value)
        try:
            return self.enum_cls(raw.lower())
        except ValueError:
            return self.enum_cls[raw]


class ProcessRunTypeEnum(_LegacyTolerantPgEnum):
    cache_ok = True

    def __init__(self):
        super().__init__(ProcessRunType, "processruntype")


class ProcessRunOutcomeEnum(_LegacyTolerantPgEnum):
    cache_ok = True

    def __init__(self):
        super().__init__(ProcessRunOutcome, "processrunoutcome")
