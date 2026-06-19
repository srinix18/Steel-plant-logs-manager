from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from beanie import Document
from pydantic import Field


class FieldType(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    EMAIL = "email"
    DATE = "date"
    BOOLEAN = "boolean"
    DROPDOWN = "dropdown"
    TEXTAREA = "textarea"


class TemplateField(Document):
    id: UUID = Field(default_factory=uuid4)
    template_id: UUID
    name: str
    label: str
    field_type: FieldType
    required: bool = False
    placeholder: Optional[str] = None
    default_value: Optional[Any] = None
    validation: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "template_fields"
        indexes = ["template_id"]
