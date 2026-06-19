from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from beanie import Document
from pydantic import Field


class RecordStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"


class Record(Document):
    id: UUID = Field(default_factory=uuid4)
    template_id: UUID
    department_id: UUID
    submitted_by: UUID
    status: RecordStatus = RecordStatus.SUBMITTED
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "records"
        indexes = ["template_id", "department_id", "submitted_by"]
