from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.models.record import RecordStatus
from app.models.template_field import FieldType


# Auth
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBrief(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole
    department_id: Optional[UUID] = None


class LoginResponse(TokenResponse):
    user: UserBrief


# Users
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    role: UserRole
    department_id: Optional[UUID] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=6)
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    department_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str
    role: UserRole
    department_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Organisations
class OrganisationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None


class OrganisationUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None


class OrganisationResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Departments
class DepartmentCreate(BaseModel):
    organisation_id: UUID
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None


class DepartmentUpdate(BaseModel):
    organisation_id: Optional[UUID] = None
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: UUID
    organisation_id: UUID
    name: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# Templates
class TemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    department_id: UUID
    is_active: bool = True
    allow_member_create: bool = True


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    department_id: Optional[UUID] = None
    is_active: Optional[bool] = None
    allow_member_create: Optional[bool] = None


class TemplateResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    department_id: UUID
    is_active: bool
    allow_member_create: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FieldValidationSchema(BaseModel):
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    pattern: Optional[str] = None
    options: list[str] = Field(default_factory=list)


class TemplateFieldCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    label: str = Field(min_length=1, max_length=200)
    field_type: FieldType
    required: bool = False
    placeholder: Optional[str] = None
    default_value: Optional[Any] = None
    validation: FieldValidationSchema = Field(default_factory=FieldValidationSchema)
    sort_order: int = 0


class TemplateFieldUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    label: Optional[str] = Field(default=None, min_length=1, max_length=200)
    field_type: Optional[FieldType] = None
    required: Optional[bool] = None
    placeholder: Optional[str] = None
    default_value: Optional[Any] = None
    validation: Optional[FieldValidationSchema] = None
    sort_order: Optional[int] = None


class TemplateFieldResponse(BaseModel):
    id: UUID
    template_id: UUID
    name: str
    label: str
    field_type: FieldType
    required: bool
    placeholder: Optional[str] = None
    default_value: Optional[Any] = None
    validation: dict[str, Any]
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateDetailResponse(TemplateResponse):
    fields: list[TemplateFieldResponse] = Field(default_factory=list)


# Records
class RecordValueInput(BaseModel):
    field_id: UUID
    value: Any


class RecordCreate(BaseModel):
    template_id: UUID
    status: RecordStatus = RecordStatus.SUBMITTED
    values: list[RecordValueInput]


class RecordUpdate(BaseModel):
    status: Optional[RecordStatus] = None
    values: Optional[list[RecordValueInput]] = None


class RecordValueResponse(BaseModel):
    id: UUID
    field_id: UUID
    field_name: str
    value: Any

    model_config = {"from_attributes": True}


class RecordResponse(BaseModel):
    id: UUID
    template_id: UUID
    department_id: UUID
    submitted_by: UUID
    status: RecordStatus
    created_at: datetime
    updated_at: datetime
    values: list[RecordValueResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


# Dashboard
class DashboardMetrics(BaseModel):
    total_organisations: int
    total_users: int
    total_departments: int
    total_templates: int
    total_records: int


class MessageResponse(BaseModel):
    message: str
