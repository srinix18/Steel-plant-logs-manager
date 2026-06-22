from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.models import Template, TemplateSection, TemplateVersion, TemplateVersionAudit, User, Department, Plant
from app.models.enums import TemplateVersionStatus
from app.schemas.moi import (
    LoginRequest,
    LoginResponse,
    PublishVersionRequest,
    TemplateDetailResponse,
    TemplateFieldResponse,
    TemplateSectionResponse,
    TemplateVersionDetailResponse,
    TemplateVersionResponse,
    UserBrief,
    UserProfile,
    UserProfileUpdate,
    OrgUserCreate,
    OrgUserUpdate,
)
from app.models.enums import UserRole, ObservationCategory
from app.services.access_scope import (
    CEO_ASSIGNABLE_ROLES,
    is_ceo_tier,
    is_platform_admin,
    validate_user_scope,
)


class AuthService:
    async def login(self, session: AsyncSession, data: LoginRequest) -> LoginResponse:
        result = await session.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()
        if not user or not verify_password(data.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")
        token = create_access_token(str(user.id), {"role": user.role.value})
        return LoginResponse(access_token=token, user=UserBrief.model_validate(user))

    async def _generate_employee_uid(self, session: AsyncSession, user: User) -> str:
        plant_code = "PLT"
        dept_code = "GEN"
        if user.plant_id:
            plant = await session.get(Plant, user.plant_id)
            if plant:
                plant_code = plant.code
        if user.department_id:
            dept = await session.get(Department, user.department_id)
            if dept:
                dept_code = dept.code

        prefix = f"{plant_code}-{dept_code}-"
        result = await session.execute(
            select(User.employee_uid).where(User.employee_uid.isnot(None), User.employee_uid.like(f"{prefix}%"))
        )
        max_seq = 0
        for (uid,) in result:
            if uid and uid.startswith(prefix):
                try:
                    max_seq = max(max_seq, int(uid.split("-")[-1]))
                except ValueError:
                    pass
        return f"{prefix}{max_seq + 1:04d}"

    async def update_profile(
        self, session: AsyncSession, user: User, data: UserProfileUpdate
    ) -> UserProfile:
        if data.full_name is not None:
            user.full_name = data.full_name.strip()
        if data.phone is not None:
            user.phone = data.phone.strip() or None
        if data.designation is not None:
            user.designation = data.designation.strip() or None
        if data.date_of_joining is not None:
            user.date_of_joining = data.date_of_joining

        if not user.employee_uid and (user.designation or data.designation):
            user.employee_uid = await self._generate_employee_uid(session, user)

        await session.flush()
        return UserProfile.model_validate(user)


class OrgUserService:
    def _assert_org_access(self, actor: User, org_id: UUID) -> None:
        if is_platform_admin(actor):
            return
        if not is_ceo_tier(actor) or actor.organisation_id != org_id:
            from fastapi import HTTPException

            raise HTTPException(status_code=403, detail="Access denied")

    async def list_org_users(self, session: AsyncSession, actor: User, org_id: UUID) -> list[UserProfile]:
        self._assert_org_access(actor, org_id)
        result = await session.execute(
            select(User).where(User.organisation_id == org_id).order_by(User.full_name)
        )
        return [UserProfile.model_validate(u) for u in result.scalars()]

    async def create_org_user(
        self, session: AsyncSession, actor: User, org_id: UUID, data: OrgUserCreate
    ) -> UserProfile:
        from fastapi import HTTPException

        self._assert_org_access(actor, org_id)
        if not is_platform_admin(actor) and data.role not in CEO_ASSIGNABLE_ROLES:
            raise HTTPException(status_code=403, detail="CEO can only assign HoD, supervisor, worker, or maintenance roles")

        existing = await session.execute(select(User).where(User.email == data.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")

        validate_user_scope(
            data.role,
            org_id,
            data.department_id,
            data.process_id,
            data.plant_id,
            data.maintenance_division,
        )

        if data.role == UserRole.HOD:
            hod_check = await session.execute(
                select(User).where(
                    User.organisation_id == org_id,
                    User.department_id == data.department_id,
                    User.role.in_([UserRole.HOD, UserRole.PLANT_ADMIN]),
                    User.is_active.is_(True),
                )
            )
            if hod_check.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Department already has an active HoD")

        user = User(
            email=data.email,
            hashed_password=get_password_hash(data.password),
            full_name=data.full_name.strip(),
            role=data.role,
            organisation_id=org_id,
            plant_id=data.plant_id,
            department_id=data.department_id,
            process_id=data.process_id if data.role == UserRole.SUPERVISOR else None,
            maintenance_division=data.maintenance_division if data.role == UserRole.MAINTENANCE else None,
            designation=data.designation,
            phone=data.phone,
            is_active=True,
        )
        session.add(user)
        await session.flush()
        return UserProfile.model_validate(user)

    async def update_org_user(
        self, session: AsyncSession, actor: User, org_id: UUID, user_id: UUID, data: OrgUserUpdate
    ) -> UserProfile:
        from fastapi import HTTPException

        self._assert_org_access(actor, org_id)
        user = await session.get(User, user_id)
        if not user or user.organisation_id != org_id:
            raise HTTPException(status_code=404, detail="User not found")

        if not is_platform_admin(actor):
            if user.role in {UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.CEO, UserRole.ORG_ADMIN}:
                raise HTTPException(status_code=403, detail="Cannot modify this user")
            if data.role and data.role not in CEO_ASSIGNABLE_ROLES:
                raise HTTPException(status_code=403, detail="CEO can only assign HoD, supervisor, worker, or maintenance roles")

        new_role = data.role or user.role
        new_dept = data.department_id if data.department_id is not None else user.department_id
        new_process = data.process_id if data.process_id is not None else user.process_id
        new_plant = data.plant_id if data.plant_id is not None else user.plant_id
        new_maint_div = (
            data.maintenance_division if data.maintenance_division is not None else user.maintenance_division
        )
        validate_user_scope(
            new_role,
            org_id,
            new_dept,
            new_process if new_role == UserRole.SUPERVISOR else None,
            new_plant,
            new_maint_div if new_role == UserRole.MAINTENANCE else None,
        )

        if data.full_name is not None:
            user.full_name = data.full_name.strip()
        if data.role is not None:
            user.role = data.role
            if data.role != UserRole.SUPERVISOR:
                user.process_id = None
            if data.role != UserRole.MAINTENANCE:
                user.maintenance_division = None
        if data.department_id is not None:
            user.department_id = data.department_id
        if data.process_id is not None and (data.role or user.role) == UserRole.SUPERVISOR:
            user.process_id = data.process_id
        if data.maintenance_division is not None and (data.role or user.role) == UserRole.MAINTENANCE:
            user.maintenance_division = data.maintenance_division
        if data.plant_id is not None:
            user.plant_id = data.plant_id
        if data.designation is not None:
            user.designation = data.designation.strip() or None
        if data.phone is not None:
            user.phone = data.phone.strip() or None
        if data.is_active is not None:
            user.is_active = data.is_active
        if data.password:
            user.hashed_password = get_password_hash(data.password)

        await session.flush()
        return UserProfile.model_validate(user)


class TemplateService:
    async def list_templates(self, session: AsyncSession) -> list[TemplateDetailResponse]:
        result = await session.execute(select(Template).order_by(Template.doc_no))
        templates = result.scalars().all()
        items: list[TemplateDetailResponse] = []
        for template in templates:
            versions_result = await session.execute(
                select(TemplateVersion)
                .where(TemplateVersion.template_id == template.id)
                .order_by(TemplateVersion.rev_no)
            )
            versions = versions_result.scalars().all()
            items.append(
                TemplateDetailResponse(
                    id=template.id,
                    scope_type=template.scope_type,
                    scope_id=template.scope_id,
                    doc_no=template.doc_no,
                    name=template.name,
                    versions=[TemplateVersionResponse.model_validate(v) for v in versions],
                )
            )
        return items

    async def get_template(self, session: AsyncSession, template_id: UUID) -> TemplateDetailResponse:
        template = await session.get(Template, template_id)
        if not template:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Template not found")
        result = await session.execute(
            select(TemplateVersion).where(TemplateVersion.template_id == template_id)
        )
        versions = result.scalars().all()
        return TemplateDetailResponse(
            id=template.id,
            scope_type=template.scope_type,
            scope_id=template.scope_id,
            doc_no=template.doc_no,
            name=template.name,
            versions=[TemplateVersionResponse.model_validate(v) for v in versions],
        )

    async def get_version_detail(self, session: AsyncSession, version_id: UUID) -> TemplateVersionDetailResponse:
        result = await session.execute(
            select(TemplateVersion)
            .where(TemplateVersion.id == version_id)
            .options(selectinload(TemplateVersion.sections).selectinload(TemplateSection.fields))
        )
        version = result.scalar_one_or_none()
        if not version:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Template version not found")
        sections = []
        for s in sorted(version.sections, key=lambda x: x.sort_order):
            sections.append(
                TemplateSectionResponse(
                    id=s.id,
                    version_id=s.version_id,
                    key=s.key,
                    title=s.title,
                    sort_order=s.sort_order,
                    section_type=s.section_type,
                    config=s.config or {},
                    fields=[
                        TemplateFieldResponse.model_validate(f)
                        for f in sorted(s.fields, key=lambda x: x.sort_order)
                    ],
                )
            )
        return TemplateVersionDetailResponse(
            id=version.id,
            template_id=version.template_id,
            rev_no=version.rev_no,
            status=version.status,
            effective_from=version.effective_from,
            effective_to=version.effective_to,
            published_at=version.published_at,
            change_summary=version.change_summary,
            is_immutable=version.is_immutable,
            sections=sections,
        )

    async def publish_version(
        self, session: AsyncSession, version_id: UUID, user: User, data: PublishVersionRequest
    ) -> TemplateVersionResponse:
        from datetime import datetime, timezone

        version = await session.get(TemplateVersion, version_id)
        if not version:
            from fastapi import HTTPException

            raise HTTPException(status_code=404, detail="Version not found")
        if version.status != TemplateVersionStatus.DRAFT:
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="Only draft versions can be published")
        version.status = TemplateVersionStatus.PUBLISHED
        version.effective_from = data.effective_from
        version.published_at = datetime.now(timezone.utc)
        version.published_by = user.id
        version.change_summary = data.change_summary
        version.is_immutable = True
        session.add(
            TemplateVersionAudit(
                version_id=version.id,
                action="published",
                actor_id=user.id,
                details={"effective_from": str(data.effective_from)},
            )
        )
        await session.flush()
        return TemplateVersionResponse.model_validate(version)
