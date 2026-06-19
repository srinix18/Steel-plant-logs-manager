from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from beanie import Document
from pydantic import Field


class RecordValue(Document):
    id: UUID = Field(default_factory=uuid4)
    record_id: UUID
    field_id: UUID
    field_name: str
    value: Any
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "record_values"
        indexes = ["record_id"]
