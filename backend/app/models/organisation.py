from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from beanie import Document
from pydantic import Field


class Organisation(Document):
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "organisations"
        indexes = ["name"]
