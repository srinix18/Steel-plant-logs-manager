from datetime import datetime, timezone
from uuid import UUID, uuid4

from beanie import Document
from pydantic import Field


class Template(Document):
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: str | None = None
    department_id: UUID
    is_active: bool = True
    allow_member_create: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "templates"
        indexes = ["department_id"]
