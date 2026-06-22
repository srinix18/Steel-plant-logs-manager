"""SQLAlchemy types for VARCHAR-backed enum columns (schema patches)."""

from enum import Enum as PyEnum

from sqlalchemy import String, cast, func
from sqlalchemy.types import TypeDecorator

from app.models.enums import MaintenanceIssueStatus, ObservationCategory, ObservationSeverity


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
