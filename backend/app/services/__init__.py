import re
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status

from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.enums import UserRole
from app.models.record import Record, RecordStatus
from app.models.record_value import RecordValue
from app.models.template_field import FieldType, TemplateField
from app.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.repositories.organisation_repository import OrganisationRepository
from app.repositories.record_repository import RecordRepository
from app.repositories.record_value_repository import RecordValueRepository
from app.repositories.template_field_repository import TemplateFieldRepository
from app.repositories.template_repository import TemplateRepository
from app.repositories.user_repository import UserRepository
from app.schemas import (
    DashboardMetrics,
    DepartmentCreate,
    DepartmentUpdate,
    LoginRequest,
    LoginResponse,
    OrganisationCreate,
    OrganisationResponse,
    OrganisationUpdate,
    RecordCreate,
    RecordResponse,
    RecordUpdate,
    RecordValueResponse,
    TemplateCreate,
    TemplateDetailResponse,
    TemplateFieldCreate,
    TemplateFieldResponse,
    TemplateFieldUpdate,
    TemplateResponse,
    TemplateUpdate,
    UserBrief,
    UserCreate,
    UserResponse,
    UserUpdate,
)


class AuthService:
    def __init__(self):
        self.user_repo = UserRepository()

    async def login(self, data: LoginRequest) -> LoginResponse:
        user = await self.user_repo.get_by_email(data.email)
        if not user or not verify_password(data.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

        token = create_access_token(str(user.id), {"role": user.role.value})
        return LoginResponse(
            access_token=token,
            user=UserBrief(
                id=user.id,
                email=user.email,
                full_name=user.full_name,
                role=user.role,
                department_id=user.department_id,
            ),
        )


class UserService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.dept_repo = DepartmentRepository()

    async def list_users(self) -> list[UserResponse]:
        users = await self.user_repo.get_all()
        return [UserResponse.model_validate(u) for u in users]

    async def get_user(self, user_id: UUID) -> UserResponse:
        user = await self._get_or_404(user_id)
        return UserResponse.model_validate(user)

    async def create_user(self, data: UserCreate) -> UserResponse:
        if await self.user_repo.get_by_email(data.email):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        await self._validate_department(data.role, data.department_id)

        user = User(
            email=data.email,
            hashed_password=get_password_hash(data.password),
            full_name=data.full_name,
            role=data.role,
            department_id=data.department_id,
            is_active=data.is_active,
        )
        await self.user_repo.create(user)
        return UserResponse.model_validate(user)

    async def update_user(self, user_id: UUID, data: UserUpdate) -> UserResponse:
        user = await self._get_or_404(user_id)
        if data.email and data.email != user.email:
            existing = await self.user_repo.get_by_email(data.email)
            if existing:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
            user.email = data.email
        if data.full_name is not None:
            user.full_name = data.full_name
        if data.role is not None:
            user.role = data.role
        if data.department_id is not None or data.role is not None:
            await self._validate_department(data.role or user.role, data.department_id if data.department_id is not None else user.department_id)
            user.department_id = data.department_id
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.password:
            user.hashed_password = get_password_hash(data.password)
        user.updated_at = datetime.now(timezone.utc)
        await self.user_repo.update(user)
        return UserResponse.model_validate(user)

    async def delete_user(self, user_id: UUID) -> None:
        user = await self._get_or_404(user_id)
        await self.user_repo.delete(user)

    async def _get_or_404(self, user_id: UUID) -> User:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    async def _validate_department(self, role: UserRole, department_id: UUID | None) -> None:
        if role in (UserRole.DEPARTMENT, UserRole.MEMBER) and not department_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department is required for this role")
        if department_id:
            dept = await self.dept_repo.get_by_id(department_id)
            if not dept:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")


class OrganisationService:
    def __init__(self):
        self.org_repo = OrganisationRepository()
        self.dept_repo = DepartmentRepository()

    async def list_organisations(self) -> list[OrganisationResponse]:
        orgs = await self.org_repo.get_all()
        return [OrganisationResponse.model_validate(o) for o in orgs]

    async def get_organisation(self, org_id: UUID) -> OrganisationResponse:
        org = await self._get_or_404(org_id)
        return OrganisationResponse.model_validate(org)

    async def create_organisation(self, data: OrganisationCreate) -> OrganisationResponse:
        from app.models.organisation import Organisation

        if await self.org_repo.get_by_name(data.name):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organisation name already exists")
        org = Organisation(name=data.name, description=data.description)
        await self.org_repo.create(org)
        return OrganisationResponse.model_validate(org)

    async def update_organisation(self, org_id: UUID, data: OrganisationUpdate) -> OrganisationResponse:
        org = await self._get_or_404(org_id)
        if data.name and data.name != org.name:
            if await self.org_repo.get_by_name(data.name):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organisation name already exists")
            org.name = data.name
        if data.description is not None:
            org.description = data.description
        org.updated_at = datetime.now(timezone.utc)
        await self.org_repo.update(org)
        return OrganisationResponse.model_validate(org)

    async def delete_organisation(self, org_id: UUID) -> None:
        org = await self._get_or_404(org_id)
        dept_count = await self.dept_repo.count_by_organisation(org_id)
        if dept_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete organisation with existing departments",
            )
        await self.org_repo.delete(org)

    async def _get_or_404(self, org_id: UUID):
        from app.models.organisation import Organisation

        org = await self.org_repo.get_by_id(org_id)
        if not org:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organisation not found")
        return org


class DepartmentService:
    def __init__(self):
        self.dept_repo = DepartmentRepository()
        self.org_repo = OrganisationRepository()

    async def list_departments(self, organisation_id: UUID | None = None) -> list:
        from app.schemas import DepartmentResponse

        if organisation_id:
            depts = await self.dept_repo.list_by_organisation(organisation_id)
        else:
            depts = await self.dept_repo.get_all()
        return [DepartmentResponse.model_validate(d) for d in depts]

    async def get_department(self, dept_id: UUID):
        from app.schemas import DepartmentResponse

        dept = await self._get_or_404(dept_id)
        return DepartmentResponse.model_validate(dept)

    async def create_department(self, data: DepartmentCreate):
        from app.models.department import Department
        from app.schemas import DepartmentResponse

        org = await self.org_repo.get_by_id(data.organisation_id)
        if not org:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organisation not found")
        if await self.dept_repo.get_by_name(data.name, data.organisation_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department name already exists in this organisation")
        dept = Department(
            organisation_id=data.organisation_id,
            name=data.name,
            description=data.description,
        )
        await self.dept_repo.create(dept)
        return DepartmentResponse.model_validate(dept)

    async def update_department(self, dept_id: UUID, data: DepartmentUpdate):
        from app.schemas import DepartmentResponse

        dept = await self._get_or_404(dept_id)
        org_id = data.organisation_id if data.organisation_id is not None else dept.organisation_id
        if data.organisation_id:
            org = await self.org_repo.get_by_id(data.organisation_id)
            if not org:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Organisation not found")
            dept.organisation_id = data.organisation_id
        if data.name and data.name != dept.name:
            if await self.dept_repo.get_by_name(data.name, org_id):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department name already exists in this organisation")
            dept.name = data.name
        if data.description is not None:
            dept.description = data.description
        dept.updated_at = datetime.now(timezone.utc)
        await self.dept_repo.update(dept)
        return DepartmentResponse.model_validate(dept)

    async def delete_department(self, dept_id: UUID) -> None:
        dept = await self._get_or_404(dept_id)
        await self.dept_repo.delete(dept)

    async def _get_or_404(self, dept_id: UUID):
        dept = await self.dept_repo.get_by_id(dept_id)
        if not dept:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
        return dept


class TemplateService:
    def __init__(self):
        self.template_repo = TemplateRepository()
        self.field_repo = TemplateFieldRepository()
        self.dept_repo = DepartmentRepository()

    async def list_templates(self, current_user: User) -> list[TemplateResponse]:
        if current_user.role == UserRole.ADMIN:
            templates = await self.template_repo.get_all()
        elif current_user.department_id:
            templates = await self.template_repo.list_active_by_department(current_user.department_id)
        else:
            templates = []
        return [TemplateResponse.model_validate(t) for t in templates]

    async def get_template(self, template_id: UUID, current_user: User) -> TemplateDetailResponse:
        template = await self._get_or_404(template_id)
        self._check_access(template, current_user)
        fields = await self.field_repo.list_by_template(template_id)
        return TemplateDetailResponse(
            **TemplateResponse.model_validate(template).model_dump(),
            fields=[TemplateFieldResponse.model_validate(f) for f in fields],
        )

    async def create_template(self, data: TemplateCreate) -> TemplateResponse:
        from app.models.template import Template

        dept = await self.dept_repo.get_by_id(data.department_id)
        if not dept:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")
        template = Template(**data.model_dump())
        await self.template_repo.create(template)
        return TemplateResponse.model_validate(template)

    async def update_template(self, template_id: UUID, data: TemplateUpdate) -> TemplateResponse:
        template = await self._get_or_404(template_id)
        if data.department_id:
            dept = await self.dept_repo.get_by_id(data.department_id)
            if not dept:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")
            template.department_id = data.department_id
        for field in ("name", "description", "is_active", "allow_member_create"):
            value = getattr(data, field)
            if value is not None:
                setattr(template, field, value)
        template.updated_at = datetime.now(timezone.utc)
        await self.template_repo.update(template)
        return TemplateResponse.model_validate(template)

    async def delete_template(self, template_id: UUID) -> None:
        template = await self._get_or_404(template_id)
        await self.field_repo.delete_by_template(template_id)
        await self.template_repo.delete(template)

    async def add_field(self, template_id: UUID, data: TemplateFieldCreate) -> TemplateFieldResponse:
        await self._get_or_404(template_id)
        if data.field_type == FieldType.DROPDOWN and not data.validation.options:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Dropdown fields require options")
        field = TemplateField(
            template_id=template_id,
            name=data.name,
            label=data.label,
            field_type=data.field_type,
            required=data.required,
            placeholder=data.placeholder,
            default_value=data.default_value,
            validation=data.validation.model_dump(),
            sort_order=data.sort_order,
        )
        await self.field_repo.create(field)
        return TemplateFieldResponse.model_validate(field)

    async def update_field(self, template_id: UUID, field_id: UUID, data: TemplateFieldUpdate) -> TemplateFieldResponse:
        field = await self._get_field_or_404(template_id, field_id)
        for attr in ("name", "label", "field_type", "required", "placeholder", "default_value", "sort_order"):
            value = getattr(data, attr)
            if value is not None:
                setattr(field, attr, value)
        if data.validation is not None:
            field.validation = data.validation.model_dump()
        field.updated_at = datetime.now(timezone.utc)
        await self.field_repo.update(field)
        return TemplateFieldResponse.model_validate(field)

    async def delete_field(self, template_id: UUID, field_id: UUID) -> None:
        field = await self._get_field_or_404(template_id, field_id)
        await self.field_repo.delete(field)

    async def _get_or_404(self, template_id: UUID):
        from app.models.template import Template

        template = await self.template_repo.get_by_id(template_id)
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        return template

    async def _get_field_or_404(self, template_id: UUID, field_id: UUID) -> TemplateField:
        field = await self.field_repo.get_by_id(field_id)
        if not field or field.template_id != template_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Field not found")
        return field

    def _check_access(self, template, current_user: User) -> None:
        if current_user.role == UserRole.ADMIN:
            return
        if current_user.department_id != template.department_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")


class RecordService:
    def __init__(self):
        self.record_repo = RecordRepository()
        self.value_repo = RecordValueRepository()
        self.template_repo = TemplateRepository()
        self.field_repo = TemplateFieldRepository()

    async def list_records(self, current_user: User) -> list[RecordResponse]:
        if current_user.role == UserRole.ADMIN:
            records = await self.record_repo.get_all()
        elif current_user.role == UserRole.DEPARTMENT:
            records = await self.record_repo.list_by_department(current_user.department_id) if current_user.department_id else []
        else:
            records = await self.record_repo.list_by_submitter(current_user.id)
        return [await self._to_response(r) for r in records]

    async def get_record(self, record_id: UUID, current_user: User) -> RecordResponse:
        record = await self._get_or_404(record_id)
        self._check_access(record, current_user)
        return await self._to_response(record)

    async def create_record(self, data: RecordCreate, current_user: User) -> RecordResponse:
        template = await self.template_repo.get_by_id(data.template_id)
        if not template or not template.is_active:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
        if current_user.role != UserRole.ADMIN:
            if current_user.department_id != template.department_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
            if current_user.role == UserRole.MEMBER and not template.allow_member_create:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Record creation not permitted")

        fields = await self.field_repo.list_by_template(data.template_id)
        validated_values = self._validate_values(fields, data.values)

        record = Record(
            template_id=data.template_id,
            department_id=template.department_id,
            submitted_by=current_user.id,
            status=data.status,
        )
        await self.record_repo.create(record)

        for field, value in validated_values:
            rv = RecordValue(
                record_id=record.id,
                field_id=field.id,
                field_name=field.name,
                value=value,
            )
            await self.value_repo.create(rv)

        return await self._to_response(record)

    async def update_record(self, record_id: UUID, data: RecordUpdate, current_user: User) -> RecordResponse:
        record = await self._get_or_404(record_id)
        self._check_access(record, current_user, allow_member_edit=True)
        if data.status is not None:
            record.status = data.status
        if data.values is not None:
            fields = await self.field_repo.list_by_template(record.template_id)
            validated_values = self._validate_values(fields, data.values)
            await self.value_repo.delete_by_record(record_id)
            for field, value in validated_values:
                rv = RecordValue(
                    record_id=record.id,
                    field_id=field.id,
                    field_name=field.name,
                    value=value,
                )
                await self.value_repo.create(rv)
        record.updated_at = datetime.now(timezone.utc)
        await self.record_repo.update(record)
        return await self._to_response(record)

    async def delete_record(self, record_id: UUID, current_user: User) -> None:
        record = await self._get_or_404(record_id)
        if current_user.role == UserRole.MEMBER:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Members cannot delete records")
        self._check_access(record, current_user)
        await self.value_repo.delete_by_record(record_id)
        await self.record_repo.delete(record)

    async def export_records_csv(self, current_user: User) -> str:
        records = await self.list_records(current_user)
        if not records:
            return "record_id,template_id,department_id,submitted_by,status,created_at\n"

        field_names: set[str] = set()
        for r in records:
            for v in r.values:
                field_names.add(v.field_name)
        sorted_fields = sorted(field_names)

        header = ["record_id", "template_id", "department_id", "submitted_by", "status", "created_at"] + sorted_fields
        lines = [",".join(header)]
        for r in records:
            value_map = {v.field_name: self._csv_escape(v.value) for v in r.values}
            row = [
                str(r.id),
                str(r.template_id),
                str(r.department_id),
                str(r.submitted_by),
                r.status.value,
                r.created_at.isoformat(),
            ] + [value_map.get(fn, "") for fn in sorted_fields]
            lines.append(",".join(row))
        return "\n".join(lines)

    def _validate_values(self, fields: list[TemplateField], inputs: list) -> list[tuple[TemplateField, Any]]:
        field_map = {f.id: f for f in fields}
        provided = {item.field_id: item.value for item in inputs}

        for field in fields:
            if field.required and field.id not in provided:
                if field.default_value is not None:
                    provided[field.id] = field.default_value
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Required field missing: {field.label}",
                    )

        result: list[tuple[TemplateField, Any]] = []
        for field_id, value in provided.items():
            field = field_map.get(field_id)
            if not field:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown field: {field_id}")
            result.append((field, self._validate_field_value(field, value)))
        return result

    def _validate_field_value(self, field: TemplateField, value: Any) -> Any:
        if value is None or value == "":
            if field.required:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} is required")
            return value

        validation = field.validation or {}

        if field.field_type == FieldType.TEXT or field.field_type == FieldType.TEXTAREA:
            if not isinstance(value, str):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} must be text")
            if validation.get("min_length") and len(value) < validation["min_length"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} is too short")
            if validation.get("max_length") and len(value) > validation["max_length"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} is too long")
            if validation.get("pattern") and not re.match(validation["pattern"], value):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} format is invalid")

        elif field.field_type == FieldType.NUMBER:
            try:
                value = float(value)
            except (TypeError, ValueError):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} must be a number")
            if validation.get("min_value") is not None and value < validation["min_value"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} is below minimum")
            if validation.get("max_value") is not None and value > validation["max_value"]:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} exceeds maximum")

        elif field.field_type == FieldType.EMAIL:
            if not isinstance(value, str) or "@" not in value:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} must be a valid email")

        elif field.field_type == FieldType.BOOLEAN:
            if not isinstance(value, bool):
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} must be boolean")

        elif field.field_type == FieldType.DROPDOWN:
            options = validation.get("options", [])
            if value not in options:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field.label} has invalid option")

        return value

    async def _to_response(self, record: Record) -> RecordResponse:
        values = await self.value_repo.list_by_record(record.id)
        return RecordResponse(
            id=record.id,
            template_id=record.template_id,
            department_id=record.department_id,
            submitted_by=record.submitted_by,
            status=record.status,
            created_at=record.created_at,
            updated_at=record.updated_at,
            values=[RecordValueResponse.model_validate(v) for v in values],
        )

    async def _get_or_404(self, record_id: UUID) -> Record:
        record = await self.record_repo.get_by_id(record_id)
        if not record:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Record not found")
        return record

    def _check_access(self, record: Record, current_user: User, allow_member_edit: bool = False) -> None:
        if current_user.role == UserRole.ADMIN:
            return
        if current_user.role == UserRole.DEPARTMENT:
            if current_user.department_id != record.department_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
            return
        if current_user.id != record.submitted_by:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        if not allow_member_edit:
            pass

    @staticmethod
    def _csv_escape(value: Any) -> str:
        s = str(value)
        if "," in s or '"' in s or "\n" in s:
            return '"' + s.replace('"', '""') + '"'
        return s


class DashboardService:
    def __init__(self):
        self.user_repo = UserRepository()
        self.org_repo = OrganisationRepository()
        self.dept_repo = DepartmentRepository()
        self.template_repo = TemplateRepository()
        self.record_repo = RecordRepository()

    async def get_metrics(self, current_user: User) -> DashboardMetrics:
        if current_user.role == UserRole.ADMIN:
            return DashboardMetrics(
                total_organisations=await self.org_repo.count(),
                total_users=await self.user_repo.count(),
                total_departments=await self.dept_repo.count(),
                total_templates=await self.template_repo.count(),
                total_records=await self.record_repo.count(),
            )
        if current_user.role == UserRole.DEPARTMENT and current_user.department_id:
            templates = await self.template_repo.list_by_department(current_user.department_id)
            records = await self.record_repo.count_by_department(current_user.department_id)
            users = await self.user_repo.list_by_department(current_user.department_id)
            return DashboardMetrics(
                total_organisations=0,
                total_users=len(users),
                total_departments=1,
                total_templates=len(templates),
                total_records=records,
            )
        my_records = await self.record_repo.list_by_submitter(current_user.id)
        templates = (
            await self.template_repo.list_active_by_department(current_user.department_id)
            if current_user.department_id
            else []
        )
        return DashboardMetrics(
            total_organisations=0,
            total_users=1,
            total_departments=1 if current_user.department_id else 0,
            total_templates=len(templates),
            total_records=len(my_records),
        )
