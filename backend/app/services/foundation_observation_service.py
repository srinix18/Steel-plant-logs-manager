from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CorrectiveAction, KPIDefinition, Observation, User
from app.models.enums import CorrectiveActionStatus
from app.schemas.foundation import (
    FoundationCorrectiveActionCreate,
    FoundationCorrectiveActionResponse,
    FoundationCorrectiveActionUpdate,
    FoundationObservationCreate,
    FoundationObservationResponse,
    FoundationObservationUpdate,
    KpiDefinitionAdminResponse,
    KpiDefinitionCreate,
    KpiDefinitionUpdate,
)
from app.services.access_scope import (
    apply_observation_department_scope,
    is_ceo_tier,
    is_platform_admin,
)


class FoundationObservationService:
    async def create_observation(
        self, session: AsyncSession, user: User, data: FoundationObservationCreate
    ) -> FoundationObservationResponse:
        obs = Observation(
            plant_id=data.plant_id,
            title=data.title,
            description=data.description,
            department_id=data.department_id or user.department_id,
            process_id=data.process_id,
            category=data.category,
            severity=data.severity,
            run_id=data.run_id,
            asset_id=data.asset_id,
            maintenance_issue_id=data.maintenance_issue_id,
            observed_by=user.id,
            observed_at=datetime.now(timezone.utc),
        )
        session.add(obs)
        await session.flush()
        return FoundationObservationResponse.model_validate(obs)

    async def list_observations(
        self,
        session: AsyncSession,
        user: User,
        plant_id: UUID | None = None,
        status: str | None = None,
    ) -> list[FoundationObservationResponse]:
        query = select(Observation)
        query = apply_observation_department_scope(query, user)
        if plant_id:
            query = query.where(Observation.plant_id == plant_id)
        if status:
            query = query.where(Observation.status == status)
        result = await session.execute(query.order_by(Observation.observed_at.desc()))
        return [FoundationObservationResponse.model_validate(o) for o in result.scalars()]

    async def update_observation(
        self, session: AsyncSession, obs_id: UUID, data: FoundationObservationUpdate
    ) -> FoundationObservationResponse:
        obs = await session.get(Observation, obs_id)
        if not obs:
            raise HTTPException(status_code=404, detail="Observation not found")
        for field in ("title", "description", "severity", "status", "maintenance_issue_id"):
            val = getattr(data, field)
            if val is not None:
                setattr(obs, field, val)
        await session.flush()
        return FoundationObservationResponse.model_validate(obs)

    async def create_corrective_action(
        self,
        session: AsyncSession,
        user: User,
        observation_id: UUID,
        data: FoundationCorrectiveActionCreate,
    ) -> FoundationCorrectiveActionResponse:
        obs = await session.get(Observation, observation_id)
        if not obs:
            raise HTTPException(status_code=404, detail="Observation not found")
        ca = CorrectiveAction(
            observation_id=observation_id,
            title=data.title,
            description=data.description,
            assigned_to=data.assigned_to,
            assigned_by=user.id,
            due_date=data.due_date,
            priority=data.priority,
        )
        session.add(ca)
        obs.status = "triaged"
        await session.flush()
        resp = FoundationCorrectiveActionResponse.model_validate(ca)
        resp.observation_title = obs.title or obs.description[:80]
        return resp

    async def list_corrective_actions(
        self,
        session: AsyncSession,
        user: User,
        plant_id: UUID | None = None,
        status: str | None = None,
    ) -> list[FoundationCorrectiveActionResponse]:
        query = select(CorrectiveAction, Observation).join(
            Observation, CorrectiveAction.observation_id == Observation.id
        )
        if not (is_platform_admin(user) or is_ceo_tier(user)):
            if user.department_id:
                query = query.where(
                    (Observation.department_id == user.department_id)
                    | (Observation.department_id.is_(None))
                )
            else:
                query = query.where(False)
        if plant_id:
            query = query.where(Observation.plant_id == plant_id)
        if status:
            query = query.where(CorrectiveAction.status == status)
        result = await session.execute(query.order_by(CorrectiveAction.due_date))
        rows = []
        for ca, obs in result.all():
            item = FoundationCorrectiveActionResponse.model_validate(ca)
            item.observation_title = obs.title or obs.description[:80]
            rows.append(item)
        return rows

    async def update_corrective_action(
        self, session: AsyncSession, user: User, action_id: UUID, data: FoundationCorrectiveActionUpdate
    ) -> FoundationCorrectiveActionResponse:
        ca = await session.get(CorrectiveAction, action_id)
        if not ca:
            raise HTTPException(status_code=404, detail="Corrective action not found")
        for field in ("title", "description", "assigned_to", "due_date", "priority"):
            val = getattr(data, field)
            if val is not None:
                setattr(ca, field, val)
        if data.status:
            ca.status = data.status
            if data.status == CorrectiveActionStatus.CLOSED:
                if not data.closure_notes and not ca.closure_notes:
                    raise HTTPException(status_code=400, detail="Closure notes required")
                ca.closure_notes = data.closure_notes or ca.closure_notes
                ca.closed_at = datetime.now(timezone.utc)
                ca.closed_by = user.id
        await session.flush()
        obs = await session.get(Observation, ca.observation_id)
        resp = FoundationCorrectiveActionResponse.model_validate(ca)
        if obs:
            resp.observation_title = obs.title or obs.description[:80]
        return resp


class KpiAdminService:
    async def list_definitions(self, session: AsyncSession) -> list[KpiDefinitionAdminResponse]:
        result = await session.execute(select(KPIDefinition).order_by(KPIDefinition.code))
        return [KpiDefinitionAdminResponse.model_validate(k) for k in result.scalars()]

    async def create_definition(
        self, session: AsyncSession, data: KpiDefinitionCreate
    ) -> KpiDefinitionAdminResponse:
        kpi = KPIDefinition(
            code=data.code,
            name=data.name,
            formula=data.formula,
            description=data.description,
            department_id=data.department_id,
            target_value=data.target_value,
            frequency=data.frequency.value if data.frequency else None,
            dimensions=data.dimensions,
            refresh_interval_minutes=data.refresh_interval_minutes,
        )
        session.add(kpi)
        await session.flush()
        return KpiDefinitionAdminResponse.model_validate(kpi)

    async def update_definition(
        self, session: AsyncSession, kpi_id: UUID, data: KpiDefinitionUpdate
    ) -> KpiDefinitionAdminResponse:
        kpi = await session.get(KPIDefinition, kpi_id)
        if not kpi:
            raise HTTPException(status_code=404, detail="KPI definition not found")
        for field in (
            "name",
            "formula",
            "description",
            "department_id",
            "target_value",
            "dimensions",
            "refresh_interval_minutes",
        ):
            val = getattr(data, field)
            if val is not None:
                setattr(kpi, field, val)
        if data.frequency is not None:
            kpi.frequency = data.frequency.value
        await session.flush()
        return KpiDefinitionAdminResponse.model_validate(kpi)
