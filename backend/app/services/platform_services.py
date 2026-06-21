from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import create_access_token, verify_password
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
