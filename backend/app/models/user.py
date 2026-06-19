from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4

from beanie import Document
from pydantic import EmailStr, Field

from app.models.enums import UserRole


class User(Document):
    id: UUID = Field(default_factory=uuid4)
    email: EmailStr
    hashed_password: str
    full_name: str
    role: UserRole
    department_id: Optional[UUID] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "users"
        indexes = ["email"]
